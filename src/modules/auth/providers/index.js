import google from "./google.js";

const PROVIDERS = {
  google,
};

const getProvider = (name) => {
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown auth provider: ${name}`);
  return provider;
};

export default { PROVIDERS, getProvider };
