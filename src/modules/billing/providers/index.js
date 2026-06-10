import creem from "./creem.js";

const PROVIDERS = {
  creem,
};

const DEFAULT_PROVIDER = "creem";

const getProvider = (name = DEFAULT_PROVIDER) => {
  const provider = PROVIDERS[name];
  if (!provider) throw new Error(`Unknown billing provider: ${name}`);
  return provider;
};

export default { PROVIDERS, getProvider };
