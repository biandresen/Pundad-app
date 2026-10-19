import axios from "axios";
import JOKE_API from "../api/joke-api";
import type { token } from "../types/context.types";
import type { PaginatedResponse } from "../types/pagination.types";
import type { CommentType, JokeType } from "../types/joke.types";
import type { LeaderboardRow } from "../types/leaderboard.types";
import type { AppLanguage } from "../i18n/translations";
import { languageHeaders } from "../lib/utils";
import { normalizeApiError } from "./normalizeApiError";

type RegisterUser = {
  username: string;
  email: string;
  password: string;
  passwordConfirmation: string;
  acceptedTerms: boolean;
};

type LoginUser = {
  userInput: string;
  password: string;
};

type ApiSuccessResponse<T> = {
  status: string;
  statusCode: number;
  message: string;
  data: T;
  count: number;
};

export const verifyEmail = async (token: string) => {
  try {
    const res = await axios.get(`${JOKE_API.BASE}${JOKE_API.VERIFY_EMAIL}`, {
      params: { token },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const resendVerificationEmail = async ({ email }: { email: string }, language?: AppLanguage) => {
  try {
    const res = await axios.post(
      `${JOKE_API.BASE}${JOKE_API.RESEND_VERIFICATION}`,
      { email },
      {
        headers: {
          ...languageHeaders(language),
        },
      },
    );

    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

type ContactMessagePayload = {
  name: string;
  email: string;
  topic: "BUG" | "FEATURE" | "SUGGESTION" | "FEEDBACK";
  message: string;
};

export const sendContactMessage = async (payload: ContactMessagePayload, language?: AppLanguage) => {
  try {
    const res = await axios.post(`${JOKE_API.BASE}${JOKE_API.CONTACT}`, payload, {
      headers: {
        "Content-Type": "application/json",
        ...languageHeaders(language),
      },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const resetPassword = async ({ email }: { email: string }, language?: AppLanguage) => {
  try {
    const res = await axios.post(
      JOKE_API.BASE + JOKE_API.RESETPASSWORD,
      { email },
      {
        headers: {
          ...languageHeaders(language),
        },
      },
    );

    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const newPassword = async (token: token | undefined, password: string) => {
  try {
    const res = await axios.post(
      JOKE_API.BASE + JOKE_API.NEWPASSWORD,
      {
        token,
        password,
      },
      {
        headers: {
          "x-frontend-url": window.location.origin,
        },
      },
    );
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const registerUser = async ({
  username,
  email,
  password,
  passwordConfirmation,
  acceptedTerms,
}: RegisterUser) => {
  try {
    const res = await axios.post(JOKE_API.BASE + JOKE_API.REGISTER, {
      username,
      email,
      password,
      passwordConfirmation,
      acceptedTerms,
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const loginUser = async ({ userInput, password }: LoginUser, language?: AppLanguage) => {
  try {
    const res = await axios.post(
      JOKE_API.BASE + JOKE_API.LOGIN,
      { userInput, password },
      {
        withCredentials: true,
        headers: {
          ...languageHeaders(language),
        },
      },
    );
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const logoutUser = async () => {
  try {
    const res = await axios.post(JOKE_API.BASE + JOKE_API.LOGOUT, {}, { withCredentials: true });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const deleteUser = async (accessToken: token, id: number | string) => {
  try {
    const res = await axios.delete(JOKE_API.BASE + JOKE_API.USER + `/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const updateUser = async (
  accessToken: string | null,
  id: number | string,
  updates: Record<string, any>,
) => {
  if (!accessToken) throw new Error("No access token provided");

  const formData = new FormData();

  Object.entries(updates).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      formData.append(key, value);
    }
  });

  try {
    const res = await axios.patch(`${JOKE_API.BASE}${JOKE_API.USER}/${id}`, formData, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const getUserByNameOrEmail = async (accessToken: token, userInput: string) => {
  try {
    const res = await axios.get(JOKE_API.BASE + JOKE_API.USERINPUT + `/${userInput}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const getMe = async (accessToken: token, language?: AppLanguage) => {
  try {
    const res = await axios.get(JOKE_API.BASE + JOKE_API.USER + `/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...languageHeaders(language),
      },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const reactivateUser = async (accessToken: token, id: number | string) => {
  try {
    const res = await axios.patch(
      JOKE_API.BASE + JOKE_API.USER + `/${id}/reactivate`,
      {},
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const deactivateUser = async (accessToken: token, id: number | string) => {
  try {
    const res = await axios.delete(JOKE_API.BASE + JOKE_API.USER + `/${id}`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const getCurrentUserDrafts = async (
  accessToken: token,
  page = 1,
  limit = 15,
  language?: AppLanguage,
): Promise<PaginatedResponse<JokeType>> => {
  try {
    const res = await axios.get(
      JOKE_API.BASE + JOKE_API.GCU_DRAFTS + `?page=${page}&limit=${limit}&sort=desc`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...languageHeaders(language),
        },
      },
    );
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const getAllJokes = async (
  _accessToken: token,
  page = 1,
  limit = 15,
  language?: AppLanguage,
): Promise<PaginatedResponse<JokeType>> => {
  try {
    const res = await axios.get(JOKE_API.BASE + JOKE_API.JOKES + `?page=${page}&limit=${limit}&sort=desc`, {
      headers: { ...languageHeaders(language) },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const getJoke = async (accessToken: token, jokeId: number, language?: AppLanguage) => {
  try {
    const res = await axios.get(`${JOKE_API.BASE}${JOKE_API.JOKES}/${jokeId}`, {
      headers: { Authorization: `Bearer ${accessToken}`, ...languageHeaders(language) },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const getPopularJokes = async (language?: AppLanguage): Promise<ApiSuccessResponse<JokeType[]>> => {
  try {
    const res = await axios.get(JOKE_API.BASE + JOKE_API.JOKES + JOKE_API.POPULAR, {
      headers: { ...languageHeaders(language) },
    });

    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const getRandomJoke = async (language?: AppLanguage) => {
  try {
    const res = await axios.get(JOKE_API.BASE + JOKE_API.JOKES + JOKE_API.RANDOM, {
      headers: { ...languageHeaders(language) },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const getDailyJoke = async (language?: AppLanguage) => {
  try {
    const res = await axios.get(JOKE_API.BASE + JOKE_API.JOKES + JOKE_API.DAILY, {
      headers: { ...languageHeaders(language) },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const saveDraft = async (
  accessToken: token,
  title: string,
  body: string,
  tags: string[],
  language?: AppLanguage,
) => {
  try {
    const res = await axios.post(
      JOKE_API.BASE + JOKE_API.JOKES,
      { title, body, published: false, tags },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...languageHeaders(language),
        },
      },
    );
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const publishJoke = async (
  accessToken: token,
  title: string,
  body: string,
  tags: string[],
  language?: AppLanguage,
) => {
  try {
    const res = await axios.post(
      JOKE_API.BASE + JOKE_API.JOKES,
      { title, body, published: true, tags },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...languageHeaders(language),
        },
      },
    );
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const editJoke = async (
  accessToken: token,
  jokeId: number,
  title: string,
  body: string,
  published: boolean,
  tags: string[],
  language?: AppLanguage,
) => {
  try {
    const res = await axios.patch(
      JOKE_API.BASE + JOKE_API.JOKES + `/${jokeId}`,
      { title, body, published, tags },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...languageHeaders(language),
        },
      },
    );
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const deleteJoke = async (accessToken: token, jokeId: number, language?: AppLanguage) => {
  try {
    console.log("Axios deleteJoke:, ", jokeId);
    const res = await axios.delete(JOKE_API.BASE + JOKE_API.JOKES + `/${jokeId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...languageHeaders(language),
      },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const toggleLike = async (accessToken: token, jokeId: number, language?: AppLanguage) => {
  try {
    const res = await axios.post(
      JOKE_API.BASE + JOKE_API.JOKES + `/${jokeId}/like`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...languageHeaders(language),
        },
        withCredentials: true,
      },
    );
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const getJokeComments = async (
  _accessToken: token,
  page = 1,
  limit = 10,
  jokeId?: number,
  sort: "asc" | "desc" = "desc",
  language?: AppLanguage,
): Promise<PaginatedResponse<CommentType>> => {
  if (!jokeId) throw normalizeApiError(new Error("Missing jokeId for comments request"));

  try {
    const res = await axios.get(`${JOKE_API.BASE}${JOKE_API.COMMENTS}/${jokeId}`, {
      params: { page, limit, sort },
      headers: { ...languageHeaders(language) },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const addComment = async (
  accessToken: token,
  jokeId: number,
  comment: string,
  language?: AppLanguage,
) => {
  try {
    const res = await axios.post(
      JOKE_API.BASE + JOKE_API.JOKES + `/${jokeId}` + JOKE_API.COMMENTS,
      { comment },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...languageHeaders(language),
        },
      },
    );
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const editComment = async (
  accessToken: token,
  commentId: number,
  comment: string,
  language?: AppLanguage,
) => {
  try {
    const res = await axios.patch(
      JOKE_API.BASE + JOKE_API.COMMENTS + `/${commentId}`,
      { comment },
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          ...languageHeaders(language),
        },
      },
    );
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const deleteComment = async (accessToken: token, commentId: number, language?: AppLanguage) => {
  try {
    const res = await axios.delete(JOKE_API.BASE + JOKE_API.COMMENTS + `/${commentId}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...languageHeaders(language),
      },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const getAllUserJokes = async (
  _accessToken: token,
  page = 1,
  limit = 15,
  userId?: number,
  language?: AppLanguage,
): Promise<PaginatedResponse<JokeType>> => {
  if (!userId) throw normalizeApiError(new Error("Missing userId"));

  try {
    const res = await axios.get(
      `${JOKE_API.BASE}${JOKE_API.USER}/${userId}/jokes?page=${page}&limit=${limit}&sort=desc`,
      {
        headers: {
          ...languageHeaders(language),
        },
      },
    );

    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const recordDailyJokeView = async (accessToken: token) => {
  try {
    const res = await axios.post(
      JOKE_API.BASE + JOKE_API.JOKES + JOKE_API.DAILY_VIEW,
      {},
      {
        headers: { Authorization: `Bearer ${accessToken}` },
        withCredentials: true,
      },
    );
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const getMyBadgeHistory = async (accessToken: token, page = 1, limit = 15, language?: AppLanguage) => {
  try {
    const res = await axios.get(`${JOKE_API.BASE}${JOKE_API.BADGE_HISTORY_ME}?page=${page}&limit=${limit}`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...languageHeaders(language),
      },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const getMyCurrentBadges = async (accessToken: token, language?: AppLanguage) => {
  try {
    const res = await axios.get(JOKE_API.BASE + JOKE_API.CURRENT_BADGES_ME, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        ...languageHeaders(language),
      },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export async function getFeaturedJoke(slug: string, language?: AppLanguage) {
  try {
    const res = await axios.get(`${JOKE_API.BASE}/featured/${slug}`, {
      headers: { ...languageHeaders(language) },
    });
    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
}

export const getLeaderboardUsers = async (
  period: "week" | "month" | "all" = "month",
  limit = 25,
  language?: AppLanguage,
) => {
  try {
    const res = await axios.get(`${JOKE_API.BASE}/leaderboard/users?period=${period}&limit=${limit}`, {
      headers: { ...languageHeaders(language) },
    });

    return res.data as {
      status: string;
      statusCode: number;
      message: string;
      data: LeaderboardRow[];
    };
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export type SearchFilters = {
  title: boolean;
  body: boolean;
  comments: boolean;
  tags: boolean;
};

export const searchJokes = async (
  _accessToken: token,
  page = 1,
  limit = 15,
  searchParameters?: string,
  filters?: SearchFilters,
  sort: "asc" | "desc" = "desc",
  language?: AppLanguage,
): Promise<PaginatedResponse<JokeType>> => {
  const params = new URLSearchParams();

  params.set("page", String(page));
  params.set("limit", String(limit));
  params.set("sort", sort);

  if (searchParameters) {
    params.set("searchParameters", searchParameters);
  }

  if (filters) {
    params.set("title", String(filters.title));
    params.set("body", String(filters.body));
    params.set("comments", String(filters.comments));
    params.set("tags", String(filters.tags));
  }

  try {
    const res = await axios.get(`${JOKE_API.BASE}${JOKE_API.JOKES}${JOKE_API.SEARCH}?${params.toString()}`, {
      headers: { ...languageHeaders(language) },
    });

    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};

export const resendEmailChangeVerification = async (accessToken: string | null) => {
  if (!accessToken) throw new Error("No access token provided");

  try {
    const res = await axios.post(
      `${JOKE_API.BASE}${JOKE_API.USER}/resend-email-change-verification`,
      {},
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    return res.data;
  } catch (err: any) {
    throw normalizeApiError(err);
  }
};
