"""
MyArea24 — Location-Based Multi-Factor Ranking Engine
Computes transparent, weighted composite ranking scores for local discovery results.

Mathematical Model:
  Final Score = (w_dist * S_dist) + (w_rel * S_rel) + (w_qual * S_qual) + (w_fresh * S_fresh)
Where:
  - S_dist: Smooth exponential spatial decay: exp(-distance_km / 5.0)
  - S_rel: Lexical keyword match priority (Title > Subcategory > Description)
  - S_qual: Verification status, Bayesian rating average, and review count volume
  - S_fresh: Open-now bonus, active discounts, and update recency
"""

import math
from typing import Any, Dict, List, Optional, Tuple


class RankingEngine:
    # Default Multi-Factor Weights (sum to 1.0)
    DEFAULT_WEIGHTS = {
        "distance": 0.40,
        "relevance": 0.30,
        "quality": 0.20,
        "freshness": 0.10,
    }

    @staticmethod
    def compute_distance_score(distance_km: Optional[float], max_radius_km: float = 15.0) -> float:
        """
        Computes spatial decay score in [0.0, 1.0].
        Uses smooth exponential decay with half-life of ~3.5 km.
        """
        if distance_km is None or distance_km < 0:
            return 0.3  # Neutral score if location coordinate is unknown
        if distance_km > max_radius_km:
            return 0.01
        # Exponential decay: 0km -> 1.0, 2km -> 0.67, 5km -> 0.36, 10km -> 0.13, 15km -> 0.05
        return round(math.exp(-distance_km / 5.0), 4)

    @staticmethod
    def compute_relevance_score(
        query_terms: List[str],
        name: str,
        category: str,
        subcategory: Optional[str] = None,
        description: Optional[str] = None,
    ) -> float:
        """
        Computes text relevance score in [0.0, 1.0].
        Exact match in name gives maximum weight.
        """
        if not query_terms:
            return 1.0  # Browsing without search query gives full neutral relevance

        name_l = (name or "").lower()
        cat_l = (category or "").lower()
        sub_l = (subcategory or "").lower()
        desc_l = (description or "").lower()

        matched_weight = 0.0
        total_possible = len(query_terms)

        for term in query_terms:
            t = term.strip().lower()
            if not t:
                continue
            if t in name_l:
                matched_weight += 1.0
            elif t in cat_l or t in sub_l:
                matched_weight += 0.7
            elif t in desc_l:
                matched_weight += 0.4

        normalized = min(1.0, matched_weight / max(1.0, float(total_possible)))
        return round(normalized, 4)

    @staticmethod
    def compute_quality_score(
        is_verified: bool,
        rating: float,
        review_count: int,
    ) -> float:
        """
        Computes quality score in [0.0, 1.0].
        Combines verified badge, normalized star rating (0-5), and review volume confidence.
        """
        v_score = 0.4 if is_verified else 0.0
        r_score = (min(5.0, max(1.0, rating)) / 5.0) * 0.4  # up to 0.4
        c_score = (min(50, review_count) / 50.0) * 0.2     # up to 0.2 volume bonus
        return round(v_score + r_score + c_score, 4)

    @staticmethod
    def compute_freshness_score(
        is_open_now: bool,
        active_offers_count: int = 0,
        active_products_count: int = 0,
    ) -> float:
        """
        Computes freshness and availability score in [0.0, 1.0].
        Open merchants and stores with active deals get preference.
        """
        score = 0.0
        if is_open_now:
            score += 0.5
        if active_offers_count > 0:
            score += 0.3
        if active_products_count > 0:
            score += 0.2
        return round(min(1.0, score), 4)

    @classmethod
    def rank_item(
        cls,
        name: str,
        category: str,
        distance_km: Optional[float],
        is_verified: bool = False,
        rating: float = 4.0,
        review_count: int = 10,
        is_open_now: bool = True,
        active_offers_count: int = 0,
        active_products_count: int = 0,
        query_terms: Optional[List[str]] = None,
        subcategory: Optional[str] = None,
        description: Optional[str] = None,
        weights: Optional[Dict[str, float]] = None,
    ) -> Tuple[float, Dict[str, Any]]:
        """
        Calculates composite ranking score and provides transparent audit breakdown.
        """
        w = weights or cls.DEFAULT_WEIGHTS
        s_dist = cls.compute_distance_score(distance_km)
        s_rel = cls.compute_relevance_score(query_terms or [], name, category, subcategory, description)
        s_qual = cls.compute_quality_score(is_verified, rating, review_count)
        s_fresh = cls.compute_freshness_score(is_open_now, active_offers_count, active_products_count)

        composite = (
            w["distance"] * s_dist
            + w["relevance"] * s_rel
            + w["quality"] * s_qual
            + w["freshness"] * s_fresh
        )

        composite_score = round(composite * 100.0, 2)

        explanation = (
            f"Rank Score: {composite_score}/100 "
            f"(Distance {round(s_dist*100)}% [{distance_km}km], "
            f"Relevance {round(s_rel*100)}%, "
            f"Quality {round(s_qual*100)}%, "
            f"Freshness {round(s_fresh*100)}%)"
        )

        breakdown = {
            "score": composite_score,
            "distance_score": round(s_dist, 3),
            "relevance_score": round(s_rel, 3),
            "quality_score": round(s_qual, 3),
            "freshness_score": round(s_fresh, 3),
            "explanation": explanation,
        }

        return composite_score, breakdown
