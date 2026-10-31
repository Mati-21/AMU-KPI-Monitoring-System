const waitText = (seconds) => {
  const minutes = Math.ceil(seconds / 60);
  return minutes > 1 ? `${minutes} minutes` : 'a minute';
};

/**
 * What to show a person when a request fails.
 */
export const apiErrorMessage = (error, fallback = 'Something went wrong. Please try again.') => {
  if (!error?.response) return 'Cannot reach the server. Please check your connection and try again.';
  const { status, data, headers } = error.response;
  if (status === 429 && headers?.['retry-after']) {
    return `${data?.message || 'Too many attempts.'} You can try again in ${waitText(Number(headers['retry-after']))}.`;
  }
  return data?.message || fallback;
};

export default apiErrorMessage;
