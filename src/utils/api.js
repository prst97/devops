export const API_BASE_URL =
  process.env.REACT_APP_API_URL || '';

export function apiFetch(path, options) {
  return fetch(`${API_BASE_URL}${path}`, options);
}
