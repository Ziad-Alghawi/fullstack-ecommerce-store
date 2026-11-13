import axios from 'axios';

export type AdminLoadStatus = 'loading' | 'ready' | 'failed' | 'forbidden';

// The API decides who is an admin, so a refused request is how a page finds out
export function getLoadFailure(error: unknown): AdminLoadStatus {
  return axios.isAxiosError(error) && error.response?.status === 403 ? 'forbidden' : 'failed';
}
