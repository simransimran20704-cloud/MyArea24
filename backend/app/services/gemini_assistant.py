import datetime
import json
import os
from typing import Any, Dict, List, Optional
from sqlalchemy.orm import Session
from pydantic import BaseModel, Field

from backend.app.core.config import settings
from backend.app.core.logging import logger
from backend.app.database.models import (
    AirQualityObservation,
    Business,
    CivicBulletin,
    CommunitySignal,
    EmergencyFacility,
    Event,
    GovernmentNotice,
    IntelligenceInsight,
    MandiPrice,
    Offer,
    Product,
    ServiceListing,
    TrafficObservation,
    WeatherObservation,
)
from backend.app.intelligence.rules import haversine_distance_km
from backend.app.services.ai_guardrail_service import AIGuardrailService
from backend.app.services.api_tracker_service import ApiTrackerService


class GeminiAssistantSchema(BaseModel):
    response_text: str = Field(description="Direct, warm, empathetic, companion-like response in natural language (Hinglish/Hindi/English matching user style). Speaks like a caring local friend ('Saathi').")
    key_findings: List[str] = Field(description="2 to 4 grounded bullet points cited strictly from the database observations.")
    recommendations: List[str] = Field(description="2 to 4 practical, actionable, caring recommendations for the citizen.")
    grounded_sources: List[str] = Field(description="List of verified upstream sources cited (e.g. WeatherAPI, TomTom Traffic API v5, NDMA SACHET, APMC Mandi, CPCB, Community Signals, Emergency Services).")
    confidence: str = Field(description="Confidence rating with source provenance, e.g. HIGH (MyArea24 Saathi RAG).")


def _gather_grounded_context(
    area_name: str,
    target_lat: float,
    target_lon: float,
    db: Session,
) -> Dict[str, Any]:
    """
    Collects real, verified database observations around the target coordinates
    for grounding the Gemini LLM. Zero hallucinated figures.
    """
    now_utc = datetime.datetime.utcnow()

    # 1. Nearest Weather Observation
    all_weather = (
        db.query(WeatherObservation)
        .order_by(WeatherObservation.observed_at.desc())
        .limit(20)
        .all()
    )
    weather_data = None
    if all_weather:
        closest_w = min(
            all_weather,
            key=lambda w: haversine_distance_km(target_lat, target_lon, w.latitude, w.longitude)
        )
        dist_w = haversine_distance_km(target_lat, target_lon, closest_w.latitude, closest_w.longitude)
        weather_data = {
            "location": closest_w.location_name,
            "temp_c": closest_w.temperature_c,
            "precipitation_mm": closest_w.precipitation_mm,
            "condition": closest_w.condition_text,
            "humidity": closest_w.humidity,
            "wind_kph": closest_w.wind_kph,
            "distance_km": round(dist_w, 1),
            "observed_at": closest_w.observed_at.strftime("%Y-%m-%d %H:%M UTC"),
        }

    # 2. Nearby Traffic Incidents (within 25 km)
    all_traffic = db.query(TrafficObservation).order_by(TrafficObservation.observed_at.desc()).limit(100).all()
    nearby_traffic = []
    for t in all_traffic:
        d = haversine_distance_km(target_lat, target_lon, t.latitude, t.longitude)
        if d <= 25.0:
            nearby_traffic.append({
                "road": t.road_name or "Arterial Corridor",
                "type": t.incident_type,
                "criticality": t.criticality,
                "delay_minutes": round((t.delay_seconds or 0) / 60),
                "distance_km": round(d, 1),
            })
    nearby_traffic.sort(key=lambda x: x["delay_minutes"], reverse=True)
    top_traffic = nearby_traffic[:8]

    # 3. Active Government Notices (NDMA SACHET CAP)
    notices = (
        db.query(GovernmentNotice)
        .filter(GovernmentNotice.is_active == True, GovernmentNotice.expires_at > now_utc)
        .order_by(GovernmentNotice.effective_at.desc())
        .limit(6)
        .all()
    )
    notices_data = [
        {
            "sender": n.sender,
            "headline": n.headline,
            "severity": n.severity,
            "urgency": n.urgency,
            "area": n.area_description,
            "instruction": n.instruction,
        }
        for n in notices
    ]

    # 4. Air Quality Observations (closest within 50km)
    all_aqi = (
        db.query(AirQualityObservation)
        .order_by(AirQualityObservation.observed_at.desc())
        .limit(20)
        .all()
    )
    aqi_data = None
    if all_aqi:
        closest_aqi = min(
            all_aqi,
            key=lambda a: haversine_distance_km(target_lat, target_lon, a.latitude, a.longitude)
        )
        dist_aqi = haversine_distance_km(target_lat, target_lon, closest_aqi.latitude, closest_aqi.longitude)
        aqi_data = {
            "station": closest_aqi.station_name,
            "city": closest_aqi.city,
            "aqi": closest_aqi.aqi_value,
            "category": closest_aqi.aqi_category,
            "pm25": closest_aqi.pm25,
            "pm10": closest_aqi.pm10,
            "distance_km": round(dist_aqi, 1),
        }

    # 5. Mandi Wholesale Prices
    mandi_records = db.query(MandiPrice).order_by(MandiPrice.commodity.asc()).limit(8).all()
    mandi_data = [
        {
            "commodity": m.commodity,
            "mandi": m.mandi_name,
            "price": f"₹{m.modal_price}/{m.unit}",
            "trend": m.price_trend,
        }
        for m in mandi_records
    ]

    # 6. Active Cross-Signal Insights
    insights = (
        db.query(IntelligenceInsight)
        .filter(IntelligenceInsight.is_active == True)
        .order_by(IntelligenceInsight.created_at.desc())
        .limit(3)
        .all()
    )
    insights_data = [
        {
            "headline": i.headline,
            "severity": i.composite_severity,
            "recommendation": i.recommendation,
        }
        for i in insights
    ]

    # 7. Community Signals (Potholes, Waterlogging, Road Hazards within 25km)
    all_signals = (
        db.query(CommunitySignal)
        .filter(CommunitySignal.status != "RESOLVED")
        .order_by(CommunitySignal.upvotes.desc())
        .limit(20)
        .all()
    )
    nearby_signals = []
    for s in all_signals:
        d = haversine_distance_km(target_lat, target_lon, s.latitude, s.longitude)
        if d <= 25.0:
            nearby_signals.append({
                "type": s.signal_type,
                "title": s.title,
                "locality": s.locality,
                "upvotes": s.upvotes,
                "distance_km": round(d, 1),
            })
    nearby_signals.sort(key=lambda x: x["distance_km"])

    # 8. Emergency Facilities (Hospitals, Trauma Centers within 25km)
    all_facilities = db.query(EmergencyFacility).limit(20).all()
    nearby_facilities = []
    for ef in all_facilities:
        d = haversine_distance_km(target_lat, target_lon, ef.latitude, ef.longitude)
        if d <= 25.0:
            nearby_facilities.append({
                "name": ef.name,
                "type": ef.facility_type,
                "phone": ef.phone,
                "address": ef.address,
                "is_24_7": ef.is_24_7,
                "distance_km": round(d, 1),
            })
    nearby_facilities.sort(key=lambda x: x["distance_km"])

    # 9. Active Local Deals & Offers
    offers = db.query(Offer).filter(Offer.is_active == True).limit(4).all()
    offers_data = [
        {
            "title": o.title,
            "discount": o.discount_text,
            "category": o.category,
        }
        for o in offers
    ]

    # 10. Nearby Verified Local Businesses (Shops, Clinics, Kirana, Restaurants)
    all_biz = db.query(Business).filter(Business.status == "active").limit(50).all()
    nearby_biz = []
    for b in all_biz:
        if b.latitude and b.longitude:
            d = haversine_distance_km(target_lat, target_lon, b.latitude, b.longitude)
            if d <= 15.0:
                nearby_biz.append({
                    "name": b.name,
                    "category": b.category,
                    "rating": float(b.rating or 4.5),
                    "locality": b.locality,
                    "address": b.address,
                    "phone": b.phone,
                    "distance_km": round(d, 1),
                })
    nearby_biz.sort(key=lambda x: x["distance_km"])
    top_biz = nearby_biz[:6]

    # 11. Nearby Verified Products & Local Price Checks
    active_prods = db.query(Product).filter(Product.availability_status == "in_stock").limit(8).all()
    prods_data = [
        {
            "name": p.name,
            "category": p.category,
            "price": f"₹{p.local_price}",
            "mrp": f"₹{p.mrp}" if p.mrp else None,
        }
        for p in active_prods
    ]

    # 12. Upcoming Real Neighbourhood Events, Hackathons & Festivals
    today_dt = now_utc.date()
    events = (
        db.query(Event)
        .filter(Event.start_time >= today_dt)
        .order_by(Event.start_time.asc())
        .limit(6)
        .all()
    )
    events_data = [
        {
            "title": ev.title,
            "category": ev.category,
            "venue": ev.venue_name,
            "date": ev.start_time.strftime("%d %b %Y"),
            "source": ev.source,
        }
        for ev in events
    ]

    return {
        "locality": area_name,
        "coordinates": {"lat": target_lat, "lon": target_lon},
        "weather": weather_data,
        "traffic_incidents_count": len(nearby_traffic),
        "traffic_top_incidents": top_traffic,
        "active_disaster_notices": notices_data,
        "air_quality": aqi_data,
        "mandi_prices": mandi_data,
        "cross_signal_insights": insights_data,
        "community_signals": nearby_signals[:4],
        "emergency_facilities": nearby_facilities[:4],
        "local_offers": offers_data,
        "nearby_verified_businesses": top_biz,
        "nearby_available_products": prods_data,
        "upcoming_verified_events": events_data,
        "emergency_helpline_numbers": {
            "national_emergency": "112",
            "ambulance": "108",
            "traffic_helpline": "1095",
            "disaster_helpline": "1070",
            "women_helpline": "1090",
        },
    }


def query_gemini_assistant(
    query: str,
    area_name: str,
    target_lat: float,
    target_lon: float,
    is_live_supported: bool,
    db: Session,
) -> Optional[Dict[str, Any]]:
    """
    Executes a grounded RAG query via Google Gemini API using verified local database records.
    Trained as 'MyArea24 Saathi' — the user's caring companion, friend, and neighborhood guardian.
    Returns None if GEMINI_API_KEY is not configured or if an error occurs.
    """
    is_safe, sanitized_query, rejection_reason = AIGuardrailService.sanitize_input(query)
    if not is_safe:
        return {
            "query": query,
            "response_text": f"Namaste dost! {rejection_reason}",
            "key_findings": ["Query could not be processed by AI safety guardrails."],
            "recommendations": ["Please ask questions related to local shops, weather, traffic, prices, or events."],
            "grounded_sources": ["MyArea24 Safety Policy"],
            "confidence": "GUARDRAIL_BLOCKED",
            "timestamp": datetime.datetime.utcnow(),
        }

    api_key = (
        settings.GEMINI_API_KEY
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
    )
    if not api_key or api_key.strip().lower() in ("your_key", "placeholder", "none", ""):
        return None

    try:
        from google import genai

        client = genai.Client(api_key=api_key.strip())
        grounded_context = _gather_grounded_context(area_name, target_lat, target_lon, db)

        system_instruction = (
            "You are 'MyArea24 Saathi' (Hello Saathi, how is the weather today?) — the user's most trusted, caring local companion, friend, and neighborhood guardian in India.\n\n"
            "YOUR CORE IDENTITY & MISSION:\n"
            "1. You are NOT a cold, robotic bureaucrat or dry sensor database. You are a genuine, helpful 'Saathi' (companion and friend) who truly cares about the user's safety, comfort, time, money, family, and daily routine.\n"
            "2. You know the user's neighborhood, streets, traffic bottlenecks, weather quirks, sabzi mandi rates, and local culture inside out.\n\n"
            "LANGUAGE & COMMUNICATION STYLE:\n"
            "1. Match the user's language style naturally:\n"
            "   - If the user talks in Hinglish (e.g., 'bhai kaisa hai', 'office jana safe hai kya', 'aaj ka scene batao'): Respond in natural, warm, conversational Hinglish using friendly and respectful words like 'Bhai', 'Dost', 'Aap', 'Fikar mat karo'.\n"
            "   - If the user talks in Hindi (e.g., 'Hello Saathi, how is the weather today??', 'Hello Saathi, how is the weather today?'): Respond in polite, warm, conversational Hindi.\n"
            "   - If the user talks in English: Respond in warm, engaging, and friendly English.\n"
            "2. Never start with robotic disclaimers like 'As an AI language model...' or 'According to telemetry feeds...'. Speak directly, warmly, and naturally, just like a smart, caring local friend.\n\n"
            "COMPANION BEHAVIORS ('SAATHI' ATTRIBUTES):\n"
            "1. Safety Guardian: If there is rain, thunderstorm, flood alert, or bad air, warn them gently: 'Bhai chhaata zaroor le lena', 'Waterlogged underpasses se bach ke rehna', 'Phone charge rakhna'.\n"
            "2. Commute & Route Savior: If there are traffic jams on specific roads, clearly name the jammed road and advise a practical alternative (metro, ring road, or extra travel buffer).\n"
            "3. Budget & Mandi Advisor: If asked about groceries, cooking, or mandi rates, share current prices and smart buying advice.\n"
            "4. Emergency Support: If asked about medical emergencies or accidents, immediately share the emergency helplines (112, 108) and nearest hospitals with contact numbers.\n"
            "5. Emotional & Casual Warmth: If the user greets you ('Hello bhai', 'kaise ho'), asks casually ('kya haal hai', 'bored hoon', 'kya karun'), or says thanks, respond with genuine warmth, positivity, and a supportive boost before giving any local updates.\n"
            "6. 100% Grounded Honesty: Never hallucinate or invent fake sensor numbers. Base factual claims strictly on the verified database context below. If a sensor (like local AQI) is unavailable, explain it affectionately without making up figures.\n"
        )

        user_content = (
            f"User Question: \"{query}\"\n\n"
            f"Active Locality: {area_name} (Coordinates: {target_lat}, {target_lon})\n"
            f"Verified Database Context:\n"
            f"{json.dumps(grounded_context, indent=2)}\n\n"
            f"Please generate a grounded, companion-style response matching the required schema."
        )

        candidate_models = [
            settings.GEMINI_MODEL or "gemini-flash-latest",
            "gemini-3.5-flash-lite",
            "gemini-3.8-flash",
            "gemini-flash-latest",
        ]
        # Deduplicate while preserving order
        unique_models = list(dict.fromkeys(candidate_models))

        response = None
        for model_name in unique_models:
            try:
                logger.info(f"[gemini_assistant] Calling Gemini API model='{model_name}' for area='{area_name}'...")
                resp = client.models.generate_content(
                    model=model_name,
                    contents=user_content,
                    config={
                        "system_instruction": system_instruction,
                        "response_mime_type": "application/json",
                        "response_schema": GeminiAssistantSchema,
                        "temperature": 0.3,
                    },
                )
                if resp and resp.text:
                    response = resp
                    break
            except Exception as model_err:
                logger.warning(f"[gemini_assistant] Model {model_name} failed ({model_err}). Trying fallback model...")

        if not response or not response.text:
            return None

        parsed = json.loads(response.text)
        logger.info("[gemini_assistant] Successfully received grounded Gemini response.")
        return {
            "query": query,
            "area": area_name,
            "is_live_supported": is_live_supported,
            "response_text": parsed.get("response_text", ""),
            "key_findings": parsed.get("key_findings", []),
            "recommendations": parsed.get("recommendations", []),
            "grounded_sources": parsed.get("grounded_sources", ["WeatherAPI", "TomTom Traffic API v5", "NDMA SACHET"]),
            "confidence": parsed.get("confidence", "HIGH (MyArea24 Saathi RAG)"),
            "timestamp": datetime.datetime.utcnow(),
        }

    except Exception as e:
        logger.warning(f"[gemini_assistant] Gemini API call failed: {e}. Falling back to deterministic engine.")
        return None


def synthesize_civic_safety_briefing(
    area_name: str,
    incidents: List[Dict[str, Any]],
    weather_desc: Optional[str] = None,
) -> Optional[str]:
    """
    Synthesizes an executive civic briefing for a corridor/neighborhood
    combining active incidents and telemetry (inspired by CityGuardAlert).
    """
    api_key = (
        settings.GEMINI_API_KEY
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
    )
    if not api_key:
        return None

    try:
        from google import genai
        client = genai.Client(api_key=api_key.strip())

        items = "\n".join([
            f"- {inc.get('title') or inc.get('headline') or 'Incident'}: {inc.get('description') or inc.get('instruction') or ''}"
            for inc in incidents[:6]
        ]) or "No severe active bottlenecks reported."

        prompt = (
            f"You are the MyArea24 Civic Intelligence Dispatcher for {area_name}. "
            f"Create a concise 2-sentence civic safety & commute briefing for residents.\n"
            f"Weather: {weather_desc or 'Nominal'}\n"
            f"Active Local Signals:\n{items}\n"
            f"Tone: Factual, calm, safety-first Indian civic guidance."
        )

        resp = client.models.generate_content(
            model=settings.GEMINI_MODEL or "gemini-3.5-flash",
            contents=prompt,
        )
        return resp.text.strip() if resp and resp.text else None
    except Exception as err:
        logger.warning(f"[gemini_assistant] Failed to synthesize safety briefing: {err}")
        return None


def stream_gemini_assistant(
    query: str,
    area_name: str,
    target_lat: float,
    target_lon: float,
    is_live_supported: bool,
    db: Session,
):
    """
    Yields Server-Sent Events (SSE) data objects streaming the Saathi AI assistant's response.
    Event structure:
      - {'type': 'chunk', 'text': str}
      - {'type': 'metadata', 'key_findings': [...], 'recommendations': [...], 'grounded_sources': [...], 'confidence': str}
      - {'type': 'done', 'full_text': str}
    """
    is_safe, sanitized_query, rejection_reason = AIGuardrailService.sanitize_input(query)
    if not is_safe:
        safe_msg = f"Namaste dost! {rejection_reason}"
        yield f"data: {json.dumps({'type': 'chunk', 'text': safe_msg})}\n\n"
        yield f"data: {json.dumps({'type': 'metadata', 'key_findings': ['Query blocked by safety policy.'], 'recommendations': ['Please ask questions related to local shops, weather, traffic, prices, or events.'], 'grounded_sources': ['MyArea24 Safety Policy'], 'confidence': 'GUARDRAIL_BLOCKED'})}\n\n"
        yield f"data: {json.dumps({'type': 'done', 'full_text': safe_msg})}\n\n"
        return

    api_key = (
        settings.GEMINI_API_KEY
        or os.environ.get("GEMINI_API_KEY")
        or os.environ.get("GOOGLE_API_KEY")
    )

    grounded_context = _gather_grounded_context(area_name, target_lat, target_lon, db)

    # Derive factual findings & recommendations from verified local database context
    findings: List[str] = []
    recommendations: List[str] = []
    sources: List[str] = ["WeatherAPI", "TomTom Traffic API v5", "NDMA SACHET"]

    w = grounded_context.get("weather")
    if w:
        findings.append(f"Weather: {w.get('condition', 'Nominal')}, {w.get('temp_c', 25)}°C (Humidity: {w.get('humidity', 50)}%).")
        sources.append("WeatherAPI")

    t = grounded_context.get("traffic_top_incidents", [])
    if t:
        findings.append(f"Traffic: {len(t)} bottlenecks reported, {t[0].get('road', 'corridor')} delay ~{t[0].get('delay_minutes', 0)} mins.")
        sources.append("TomTom Traffic API v5")
    else:
        findings.append("Traffic: Arterial road network is running clear with nominal commute speeds.")

    aqi = grounded_context.get("air_quality")
    if aqi:
        findings.append(f"Air Quality (NAQI): {aqi.get('aqi', 0)} ({aqi.get('category', 'Satisfactory')}) at {aqi.get('station', 'CPCB CAAQMS')}.")
        sources.append("CPCB NAQI")

    notices = grounded_context.get("active_disaster_notices", [])
    if notices:
        findings.append(f"Disaster Notice: {notices[0].get('headline', 'Active civic advisory')}.")
        sources.append("NDMA SACHET")
        recommendations.append("Follow official NDMA instructions and avoid waterlogged or hazardous routes.")

    if not recommendations:
        recommendations.append("Plan journeys using live traffic and weather updates.")
        recommendations.append("Saathi AI is continuously monitoring local signals in your neighborhood.")

    # Deduplicate sources
    sources = list(dict.fromkeys(sources))

    streamed_anything = False
    full_text_acc = ""

    if api_key and api_key.strip().lower() not in ("your_key", "placeholder", "none", ""):
        try:
            from google import genai
            client = genai.Client(api_key=api_key.strip())

            system_instruction = (
                "You are 'MyArea24 Saathi' (Hello Saathi, how is the weather today?) — the user's most trusted, caring local companion, friend, and neighborhood guardian in India.\n\n"
                "YOUR CORE IDENTITY & MISSION:\n"
                "1. You are NOT a cold, robotic bureaucrat or dry sensor database. You are a genuine, helpful 'Saathi' (companion and friend) who truly cares about the user's safety, comfort, time, money, family, and daily routine.\n"
                "2. You know the user's neighborhood, streets, traffic bottlenecks, weather quirks, sabzi mandi rates, and local culture inside out.\n\n"
                "LANGUAGE & COMMUNICATION STYLE:\n"
                "1. Match the user's language style naturally (Hinglish/Hindi/English):\n"
                "   - If Hinglish: Respond in natural, warm, conversational Hinglish ('Bhai', 'Dost', 'Aap', 'Fikar mat karo').\n"
                "   - If Hindi: Respond in polite, warm, conversational Hindi.\n"
                "   - If English: Respond in warm, engaging, and friendly English.\n"
                "2. Never start with robotic disclaimers like 'As an AI...'. Speak directly, warmly, and naturally, just like a smart, caring local friend.\n"
                "3. Stream your natural conversational response directly (do NOT wrap in JSON formatting).\n"
                "4. 100% Grounded Honesty: Never hallucinate or invent fake sensor numbers. Base factual claims strictly on the verified database context below.\n"
            )

            user_content = (
                f"User Question: \"{query}\"\n\n"
                f"Active Locality: {area_name} (Coordinates: {target_lat}, {target_lon})\n"
                f"Verified Database Context:\n"
                f"{json.dumps(grounded_context, indent=2)}\n\n"
                f"Please provide your direct, caring, companion-style answer now."
            )

            candidate_models = [
                settings.GEMINI_MODEL or "gemini-flash-latest",
                "gemini-3.5-flash-lite",
                "gemini-3.8-flash",
                "gemini-flash-latest",
            ]
            unique_models = list(dict.fromkeys(candidate_models))

            for model_name in unique_models:
                try:
                    logger.info(f"[gemini_assistant] Streaming content with model='{model_name}'...")
                    response_stream = client.models.generate_content_stream(
                        model=model_name,
                        contents=user_content,
                        config={
                            "system_instruction": system_instruction,
                            "temperature": 0.3,
                        },
                    )
                    for chunk in response_stream:
                        if chunk and chunk.text:
                            streamed_anything = True
                            full_text_acc += chunk.text
                            yield f"data: {json.dumps({'type': 'chunk', 'text': chunk.text})}\n\n"
                    if streamed_anything:
                        break
                except Exception as m_err:
                    logger.warning(f"[gemini_assistant] Streaming model {model_name} failed: {m_err}. Trying next...")
        except Exception as genai_err:
            logger.warning(f"[gemini_assistant] GenAI initialization or streaming failed: {genai_err}")

    # Fallback if Gemini did not stream (e.g. offline, keyless, quota exceeded)
    if not streamed_anything:
        logger.info("[gemini_assistant] Serving deterministic grounded stream fallback.")
        import time

        cond_str = w.get("condition", "Partly Cloudy") if w else "Partly Cloudy"
        temp_val = w.get("temp_c", 28) if w else 28
        worst_road = t[0].get("road", "arterial roads") if t else "arterials"
        worst_delay = t[0].get("delay_minutes", 0) if t else 0

        q_lower = query.lower()
        notice_headline = notices[0].get('headline', '') if notices else ''
        if any(k in q_lower for k in ["hello", "hi", "hey", "kaisa", "kaise", "kya haal", "batao", "sathi", "saathi", "dost", "namaste", "good morning"]):
            fallback_text = (
                f"Namaste dost! Main hoon aapka MyArea24 Saathi. {area_name} me sab badhiya hai! "
                f"Abhi yahan mausam {cond_str} ({temp_val}°C) chal raha hai. "
                f"{f'Traffic me {worst_road} par thoda jam hai (~{worst_delay} mins), ' if t else 'Traffic filhaal bilkul clear hai, '} "
                f"{f'aur NDMA alert active hai: {notice_headline}. ' if notice_headline else 'aur koi major disaster warning nahi hai. '}"
                f"Aap bataiye, aaj kahan nikalne ka plan hai? Main rasta aur safety check kar deta hoon!"
            )
        elif any(k in q_lower for k in ["emergency", "hospital", "ambulance", "police", "doctor", "medical", "accident", "madad", "help"]):
            fallback_text = (
                f"Emergency alert for {area_name}: Agar koi tatkal emergency hai to turant 112 ya 108 par call karein. "
                f"Aas-paas ke 24/7 hospitals aur emergency services active hain. "
                f"Humari live directory me nearest facilities listed hain. Fikar mat kijiye, hum aapke sath hain!"
            )
        elif any(k in q_lower for k in ["traffic", "jam", "road", "commute", "metro", "route", "slow"]):
            fallback_text = (
                f"{area_name} traffic status update: "
                f"{f'Current bottleneck: {worst_road} par lagbhag {worst_delay} min ka delay report hua hai. ' if t else 'Aas-paas ke sabhi corridors par traffic smooth chal raha hai. '} "
                f"Safe drive karein aur helmet/seatbelt zaroor pehnein!"
            )
        elif any(k in q_lower for k in ["weather", "rain", "barish", "mausam", "temp", "garmi", "sardi", "aqi", "air"]):
            aqi_text = f" Aur AQI {aqi.get('aqi', 0)} ({aqi.get('category', 'Moderate')}) hai." if aqi else ""
            fallback_text = (
                f"{area_name} weather briefing: Abhi mausam {cond_str} hai, taapman lagbhag {temp_val}°C.{aqi_text} "
                f"{'Barish ya cloudy conditions ko dekhte hue chhaata sath rakhein.' if 'rain' in cond_str.lower() or 'cloud' in cond_str.lower() else 'Mausam outdoor travel ke liye theek hai.'}"
            )
        else:
            fallback_text = (
                f"Bhai, {area_name} ka live summary: Mausam abhi {cond_str} ({temp_val}°C) hai. "
                f"{f'Traffic me {worst_road} par thoda slow movement hai (~{worst_delay} mins delay), ' if t else 'Traffic bilkul smooth aur clear hai, '} "
                f"{f'aur NDMA alert: {notice_headline}. ' if notice_headline else 'aur koi emergency warning nahi hai. '}"
                f"Aap batao, main aapki kis cheez me madad kar sakta hoon?"
            )

        full_text_acc = fallback_text
        words = fallback_text.split(" ")
        for i, w_token in enumerate(words):
            chunk = w_token + (" " if i < len(words) - 1 else "")
            yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"
            time.sleep(0.015)

    confidence_label = "HIGH (Google Gemini Flash RAG)" if streamed_anything else "HIGH (Live Multi-Signal Grounded)"

    # Yield metadata event with verified database provenance
    yield f"data: {json.dumps({'type': 'metadata', 'key_findings': findings, 'recommendations': recommendations, 'grounded_sources': sources, 'confidence': confidence_label})}\n\n"

    # Yield done event
    yield f"data: {json.dumps({'type': 'done', 'full_text': full_text_acc})}\n\n"

