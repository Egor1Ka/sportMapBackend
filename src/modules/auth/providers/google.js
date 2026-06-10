const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI } =
  process.env;

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
const GOOGLE_SCOPE = "openid email profile";

const buildGoogleAuthUrl = (state) => {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    redirect_uri: GOOGLE_REDIRECT_URI,
    response_type: "code",
    scope: GOOGLE_SCOPE,
    state,
    access_type: "offline",
    prompt: "consent",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
};

const exchangeGoogleCode = async (code) => {
  const params = new URLSearchParams({
    client_id: GOOGLE_CLIENT_ID,
    client_secret: GOOGLE_CLIENT_SECRET,
    redirect_uri: GOOGLE_REDIRECT_URI,
    grant_type: "authorization_code",
    code,
  });

  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  const data = await response.json();

  if (data.error)
    throw new Error(
      `Google token error: ${data.error_description || data.error}`,
    );

  return data;
};

const fetchGoogleUserInfo = async (accessToken) => {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  const data = await response.json();

  if (data.error) throw new Error(`Google userinfo error: ${data.error}`);

  return data;
};

const normalizeGoogleProfile = (raw) => ({
  providerUserId: raw.sub,
  email: raw.email,
  name: raw.name,
  avatar: raw.picture,
});

const getGoogleProfile = async (tokens) => {
  const raw = await fetchGoogleUserInfo(tokens.access_token);
  return normalizeGoogleProfile(raw);
};

export default {
  buildAuthUrl: buildGoogleAuthUrl,
  exchangeCode: exchangeGoogleCode,
  getProfile: getGoogleProfile,
};
