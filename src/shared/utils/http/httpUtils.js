export const parseAuthToken = (authorization) => {
  if (!authorization) return null;
  return authorization.split(" ")[1];
};
