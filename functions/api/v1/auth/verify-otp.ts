export async function onRequestPost(context: { request: Request }) {
  try {
    const body: any = await context.request.json().catch(() => ({}));
    const rawTarget = (body.identifier || body.email || body.phone || '').trim();
    const code = String(body.otp_code || '').trim();

    if (!code || code.length !== 6) {
      return new Response(
        JSON.stringify({ detail: 'Please enter a valid 6-digit verification code.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const cleanEmail = (body.email || (rawTarget.includes('@') ? rawTarget : `${rawTarget}@sms.myarea24.in`)).toLowerCase();
    const phone = body.phone || (cleanEmail.includes('@sms') ? cleanEmail.split('@')[0] : undefined);
    const fullName = body.full_name || (phone ? `User ${phone.slice(-4)}` : cleanEmail.split('@')[0]);

    const fakeToken = `ey_myarea24_${Date.now()}_${Math.random().toString(36).substring(2)}`;

    return new Response(
      JSON.stringify({
        access_token: fakeToken,
        refresh_token: fakeToken + '_ref',
        token_type: 'bearer',
        user: {
          id: Math.floor(1000 + Math.random() * 9000),
          email: cleanEmail,
          phone: phone,
          full_name: fullName,
          role: body.role || 'resident',
          is_active: true,
          is_verified: true,
          businesses: [],
        },
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
        },
      }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ detail: err.message || 'Server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
    },
  });
}
