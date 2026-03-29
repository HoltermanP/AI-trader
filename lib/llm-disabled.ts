/** Server: zet DISABLE_LLM_CALLS=true in .env om alle betaalde LLM-routes te blokkeren. */
export function isLlmDisabledByEnv(): boolean {
  const v = process.env.DISABLE_LLM_CALLS;
  return v === '1' || v === 'true' || v === 'yes';
}
