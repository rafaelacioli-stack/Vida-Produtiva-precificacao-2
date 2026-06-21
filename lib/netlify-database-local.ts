export function getDatabase(): never {
  throw new Error("Netlify Database está disponível somente no Netlify ou por meio do netlify dev.");
}
