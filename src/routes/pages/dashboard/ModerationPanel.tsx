import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

import Input from "../../../components/atoms/Input";
import Button from "../../../components/atoms/Button";
import Spinner from "../../../components/atoms/Spinner";
import Modal from "../../../components/molecules/Modal";

import { useAuth } from "../../../contexts/AuthContext";
import { useLanguage } from "../../../contexts/LanguageContext";
import { useModeration } from "../../../contexts/ModerationContext";
import { safeRequest } from "../../../lib/auth";
import { getApiErrorMessage } from "../../../lib/apiErrors";
import {
  createModerationTerm,
  deleteModerationTerm,
  getModerationCacheMeta,
  getModerationTerms,
  reloadModerationCache,
  updateModerationTerm,
  type ModerationCacheMeta,
  type ModerationCategory,
  type ModerationTerm,
} from "../../../lib/axiosModeration";

const CATEGORY_OPTIONS: Array<{ value: ModerationCategory; labelKey: string }> = [
  { value: "profanity", labelKey: "moderationAdmin.categories.profanity" },
  { value: "insult", labelKey: "moderationAdmin.categories.insult" },
  { value: "sexual", labelKey: "moderationAdmin.categories.sexual" },
  { value: "slur", labelKey: "moderationAdmin.categories.slur" },
  { value: "other", labelKey: "moderationAdmin.categories.other" },
];

const ModerationPanel = () => {
  const { accessToken, setAccessToken } = useAuth();
  const { t, tf } = useLanguage();
  const { reloadTerms } = useModeration();

  const [terms, setTerms] = useState<ModerationTerm[]>([]);
  const [cacheMeta, setCacheMeta] = useState<ModerationCacheMeta | null>(null);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [reloadingCache, setReloadingCache] = useState(false);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const [newTerm, setNewTerm] = useState("");
  const [newCategory, setNewCategory] = useState<ModerationCategory | "">("");
  const [newIsActive, setNewIsActive] = useState(true);

  const [editingTerm, setEditingTerm] = useState<ModerationTerm | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editCategory, setEditCategory] = useState<ModerationCategory | "">("");
  const [editIsActive, setEditIsActive] = useState(true);

  const [deleteTarget, setDeleteTarget] = useState<ModerationTerm | null>(null);

  const [newTermError, setNewTermError] = useState("");
  const [editTermError, setEditTermError] = useState("");

  const getFieldError = (err: any, fieldName: string) => {
    const errors = err?.response?.data?.errors;
    if (!Array.isArray(errors)) return null;

    const match = errors.find((error: any) => error?.field === fieldName);
    return match?.message ?? null;
  };

  const loadAll = useCallback(async () => {
    if (!accessToken) return;

    try {
      setLoading(true);

      const [termsRes, cacheRes] = await Promise.all([
        safeRequest(getModerationTerms, accessToken, setAccessToken),
        safeRequest(getModerationCacheMeta, accessToken, setAccessToken),
      ]);

      setTerms(termsRes.data ?? []);
      setCacheMeta(cacheRes.data ?? null);
    } catch (err: any) {
      toast.error(
        getApiErrorMessage(err, t("moderationAdmin.toasts.loadFailed"))
      );
    } finally {
      setLoading(false);
    }
  }, [accessToken, setAccessToken, t]);

  const refreshAdminAndPublicTerms = useCallback(async () => {
    await Promise.all([loadAll(), reloadTerms()]);
  }, [loadAll, reloadTerms]);

  useEffect(() => {
    void refreshAdminAndPublicTerms();
  }, [refreshAdminAndPublicTerms]);

  const filteredTerms = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return terms.filter((term) => {
      const matchesSearch =
        !normalizedSearch ||
        term.term.toLowerCase().includes(normalizedSearch) ||
        (term.category ?? "").toLowerCase().includes(normalizedSearch);

      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" && term.isActive) ||
        (statusFilter === "inactive" && !term.isActive);

      const matchesCategory =
        categoryFilter === "all" || term.category === categoryFilter;

      return matchesSearch && matchesStatus && matchesCategory;
    });
  }, [terms, search, statusFilter, categoryFilter]);

  const activeCount = useMemo(
    () => terms.filter((term) => term.isActive).length,
    [terms]
  );

  const inactiveCount = useMemo(
    () => terms.filter((term) => !term.isActive).length,
    [terms]
  );

  const handleCreate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!accessToken || !newTerm.trim() || submitting) return;

    try {
      setSubmitting(true);
      setNewTermError("");

      const res = await safeRequest(
        createModerationTerm,
        accessToken,
        setAccessToken,
        {
          term: newTerm.trim(),
          category: newCategory || undefined,
          isActive: newIsActive,
        }
      );

      if (res.statusCode !== 201) {
        throw new Error(res.message || t("moderationAdmin.toasts.createFailed"));
      }

      toast.success(t("moderationAdmin.toasts.created"));
      setNewTerm("");
      setNewCategory("");
      setNewIsActive(true);
      setNewTermError("");

      await refreshAdminAndPublicTerms();
    } catch (err: any) {
      const termError = getFieldError(err, "term");

      if (termError) {
        setNewTermError(t("moderationAdmin.errors.duplicateTerm"));
      } else {
        toast.error(
          getApiErrorMessage(err, t("moderationAdmin.toasts.createFailed"))
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const openEditModal = (term: ModerationTerm) => {
    setEditingTerm(term);
    setEditValue(term.term);
    setEditCategory(term.category ?? "");
    setEditIsActive(term.isActive);
    setEditTermError("");
  };

  const closeEditModal = () => {
    if (submitting) return;

    setEditingTerm(null);
    setEditValue("");
    setEditCategory("");
    setEditIsActive(true);
    setEditTermError("");
  };

  const handleUpdate = async () => {
    if (!accessToken || !editingTerm || !editValue.trim() || submitting) return;

    try {
      setSubmitting(true);
      setEditTermError("");

      const res = await safeRequest(
        updateModerationTerm,
        accessToken,
        setAccessToken,
        editingTerm.id,
        {
          term: editValue.trim(),
          category: editCategory || undefined,
          isActive: editIsActive,
        }
      );

      if (res.statusCode !== 200) {
        throw new Error(res.message || t("moderationAdmin.toasts.updateFailed"));
      }

      toast.success(t("moderationAdmin.toasts.updated"));
      closeEditModal();

      await refreshAdminAndPublicTerms();
    } catch (err: any) {
      const termError = getFieldError(err, "term");

      if (termError) {
        setEditTermError(t("moderationAdmin.errors.duplicateTerm"));
      } else {
        toast.error(
          getApiErrorMessage(err, t("moderationAdmin.toasts.updateFailed"))
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (term: ModerationTerm) => {
    if (!accessToken || submitting) return;

    try {
      setSubmitting(true);

      const res = await safeRequest(
        updateModerationTerm,
        accessToken,
        setAccessToken,
        term.id,
        {
          isActive: !term.isActive,
        }
      );

      if (res.statusCode !== 200) {
        throw new Error(res.message || t("moderationAdmin.toasts.statusFailed"));
      }

      toast.success(
        term.isActive
          ? t("moderationAdmin.toasts.deactivated")
          : t("moderationAdmin.toasts.activated")
      );

      await refreshAdminAndPublicTerms();
    } catch (err: any) {
      toast.error(
        getApiErrorMessage(err, t("moderationAdmin.toasts.statusFailed"))
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!accessToken || !deleteTarget || submitting) return;

    try {
      setSubmitting(true);

      const res = await safeRequest(
        deleteModerationTerm,
        accessToken,
        setAccessToken,
        deleteTarget.id
      );

      if (res.statusCode !== 200) {
        throw new Error(res.message || t("moderationAdmin.toasts.deleteFailed"));
      }

      toast.success(t("moderationAdmin.toasts.deleted"));
      setDeleteTarget(null);

      await refreshAdminAndPublicTerms();
    } catch (err: any) {
      toast.error(
        getApiErrorMessage(err, t("moderationAdmin.toasts.deleteFailed"))
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReloadCache = async () => {
    if (!accessToken || reloadingCache) return;

    try {
      setReloadingCache(true);

      const res = await safeRequest(
        reloadModerationCache,
        accessToken,
        setAccessToken
      );

      if (res.statusCode !== 200) {
        throw new Error(res.message || t("moderationAdmin.toasts.reloadFailed"));
      }

      toast.success(t("moderationAdmin.toasts.reloaded"));
      await refreshAdminAndPublicTerms();
    } catch (err: any) {
      toast.error(
        getApiErrorMessage(err, t("moderationAdmin.toasts.reloadFailed"))
      );
    } finally {
      setReloadingCache(false);
    }
  };

  if (!accessToken) {
    return (
      <div className="text-center text-[var(--text1)] mt-6">
        {t("moderationAdmin.states.adminRequired")}
      </div>
    );
  }

  if (loading) {
    return <Spinner />;
  }

  return (
  <div className="flex flex-col gap-6">
    <Modal
      isOpen={!!deleteTarget}
      title={t("moderationAdmin.deleteModal.title")}
      message={
        deleteTarget
          ? tf("moderationAdmin.deleteModal.message", {
              term: deleteTarget.term,
            })
          : ""
      }
      confirmText={
        submitting
          ? t("moderationAdmin.deleteModal.deleting")
          : t("moderationAdmin.deleteModal.confirm")
      }
      cancelText={t("moderationAdmin.deleteModal.cancel")}
      onConfirm={handleDelete}
      onCancel={() => {
        if (submitting) return;
        setDeleteTarget(null);
      }}
    />

    <Modal
      isOpen={!!editingTerm}
      title={t("moderationAdmin.editModal.title")}
      message=""
      confirmText={
        submitting
          ? t("moderationAdmin.editModal.saving")
          : t("moderationAdmin.editModal.confirm")
      }
      cancelText={t("moderationAdmin.editModal.cancel")}
      onConfirm={handleUpdate}
      onCancel={closeEditModal}
    >
      <div className="flex flex-col gap-4 mt-4">
        <Input
          id="edit-term"
          label={t("moderationAdmin.fields.term")}
          value={editValue}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
            setEditValue(e.target.value);
            if (editTermError) setEditTermError("");
          }}
          inputValid={!!editValue.trim() && !editTermError}
          errorMsg={
            editTermError ||
            (!editValue.trim() ? t("moderationAdmin.errors.termRequired") : "")
          }
        />

        <div className="flex flex-col gap-2">
          <label className="text-[var(--text2)] font-semibold">
            {t("moderationAdmin.fields.category")}
          </label>
          <select
            value={editCategory}
            onChange={(e) => setEditCategory(e.target.value as ModerationCategory | "")}
            className="bg-[var(--bg)] text-[var(--text1)] rounded-xl px-3 py-3"
          >
            <option value="">{t("moderationAdmin.filters.noCategory")}</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 text-[var(--text2)]">
          <input
            type="checkbox"
            checked={editIsActive}
            onChange={(e) => setEditIsActive(e.target.checked)}
          />
          {t("moderationAdmin.fields.active")}
        </label>
      </div>
    </Modal>

    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <h3 className="text-2xl md:text-4xl text-[var(--text1)] font-bold">
        {t("moderationAdmin.heading")}
      </h3>

      <Button
        type="button"
        variant="secondary"
        onClick={handleReloadCache}
        disabled={reloadingCache}
        label={t("moderationAdmin.actions.reloadCache")}
      >
        {reloadingCache
          ? t("moderationAdmin.actions.reloadingCache")
          : t("moderationAdmin.actions.reloadCache")}
      </Button>
    </div>

    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-2xl bg-[var(--bg)] p-4">
        <div className="text-sm opacity-70 text-[var(--text1)]">
          {t("moderationAdmin.cards.totalTerms")}
        </div>
        <div className="text-2xl font-bold text-[var(--text1)]">{terms.length}</div>
      </div>

      <div className="rounded-2xl bg-[var(--bg)] p-4">
        <div className="text-sm opacity-70 text-[var(--text1)]">
          {t("moderationAdmin.cards.active")}
        </div>
        <div className="text-2xl font-bold text-[var(--text1)]">{activeCount}</div>
      </div>

      <div className="rounded-2xl bg-[var(--bg)] p-4">
        <div className="text-sm opacity-70 text-[var(--text1)]">
          {t("moderationAdmin.cards.inactive")}
        </div>
        <div className="text-2xl font-bold text-[var(--text1)]">{inactiveCount}</div>
      </div>

      <div className="rounded-2xl bg-[var(--bg)] p-4">
        <div className="text-sm opacity-70 text-[var(--text1)]">
          {t("moderationAdmin.cards.cacheLoaded")}
        </div>
        <div className="text-2xl font-bold text-[var(--text1)]">
          {cacheMeta?.count ?? 0}
        </div>
        <div className="text-xs opacity-70 text-[var(--text1)] mt-1 break-words">
          {cacheMeta?.lastLoadedAt
            ? new Date(cacheMeta.lastLoadedAt).toLocaleString()
            : t("moderationAdmin.states.notLoaded")}
        </div>
      </div>
    </div>

    <div className="rounded-2xl border border-[var(--text1)]/10 bg-[var(--bg-input)] p-4 md:p-6">
      <h4 className="text-xl font-bold text-[var(--text1)] mb-4">
        {t("moderationAdmin.create.heading")}
      </h4>

      <form onSubmit={handleCreate} className="grid gap-4 xl:grid-cols-4">
        <div className="xl:col-span-2">
          <Input
            id="new-term"
            label={t("moderationAdmin.fields.term")}
            value={newTerm}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
              setNewTerm(e.target.value);
              if (newTermError) setNewTermError("");
            }}
            inputValid={!!newTerm.trim() && !newTermError}
            errorMsg={
              newTermError ||
              (!newTerm.trim() ? t("moderationAdmin.errors.termRequired") : "")
            }
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-[var(--text1)] font-semibold">
            {t("moderationAdmin.fields.category")}
          </label>
          <select
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value as ModerationCategory | "")}
            className="bg-[var(--bg)] text-[var(--text1)] rounded-xl px-3 py-3"
          >
            <option value="">{t("moderationAdmin.filters.noCategory")}</option>
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col justify-end gap-3">
          <label className="flex items-center gap-2 text-[var(--text1)]">
            <input
              type="checkbox"
              checked={newIsActive}
              onChange={(e) => setNewIsActive(e.target.checked)}
            />
            {t("moderationAdmin.fields.active")}
          </label>

          <Button
            type="submit"
            variant="tertiary"
            disabled={submitting || !newTerm.trim()}
            label={t("moderationAdmin.actions.addTerm")}
            className="w-full"
          >
            {submitting
              ? t("moderationAdmin.actions.saving")
              : t("moderationAdmin.actions.addTerm")}
          </Button>
        </div>
      </form>
    </div>

    <div className="rounded-2xl border border-[var(--text1)]/10 bg-[var(--bg-input)] p-4 md:p-6">
      <div className="flex flex-col gap-4 mb-6 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex-1">
          <Input
            id="moderation-search"
            label={t("moderationAdmin.filters.search")}
            value={search}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearch(e.target.value)}
            inputValid
            errorMsg=""
            placeholder={t("moderationAdmin.filters.searchPlaceholder")}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 xl:w-[380px]">
          <div className="flex flex-col gap-2">
            <label className="text-[var(--text1)] font-semibold">
              {t("moderationAdmin.filters.status")}
            </label>
            <select
              value={statusFilter}
              onChange={(e) =>
                setStatusFilter(e.target.value as "all" | "active" | "inactive")
              }
              className="bg-[var(--bg)] text-[var(--text1)] rounded-xl px-3 py-3"
            >
              <option value="all">{t("moderationAdmin.filters.all")}</option>
              <option value="active">{t("moderationAdmin.filters.active")}</option>
              <option value="inactive">{t("moderationAdmin.filters.inactive")}</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label className="text-[var(--text1)] font-semibold">
              {t("moderationAdmin.filters.category")}
            </label>
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="bg-[var(--bg)] text-[var(--text1)] rounded-xl px-3 py-3"
            >
              <option value="all">{t("moderationAdmin.filters.all")}</option>
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Mobile cards */}
      <div className="flex flex-col gap-3 lg:hidden">
        {filteredTerms.length === 0 ? (
          <div className="py-6 text-center opacity-70 text-[var(--text1)]">
            {t("moderationAdmin.states.noTermsFound")}
          </div>
        ) : (
          filteredTerms.map((term) => (
            <div
              key={term.id}
              className="rounded-2xl border border-[var(--text1)]/10 bg-[var(--bg)] p-3 text-[var(--text1)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs opacity-70">
                    {t("moderationAdmin.table.term")}
                  </p>
                  <p className="font-semibold break-words text-sm">{term.term}</p>
                </div>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[0.65rem] ${
                    term.isActive
                      ? "bg-[var(--success)] text-green-100"
                      : "bg-[var(--button2)] text-[var(--text2)]"
                  }`}
                >
                  {term.isActive
                    ? t("moderationAdmin.filters.active")
                    : t("moderationAdmin.filters.inactive")}
                </span>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <p className="opacity-70">{t("moderationAdmin.table.category")}</p>
                  <p>
                    {term.category
                      ? t(`moderationAdmin.categories.${term.category}`)
                      : "—"}
                  </p>
                </div>

                <div>
                  <p className="opacity-70">{t("moderationAdmin.table.updated")}</p>
                  <p className="break-words">
                    {new Date(term.updatedAt).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => openEditModal(term)}
                  disabled={submitting}
                  label={t("moderationAdmin.actions.edit")}
                  className="w-full text-xs!"
                >
                  {t("moderationAdmin.actions.edit")}
                </Button>

                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => handleToggleActive(term)}
                  disabled={submitting}
                  label={
                    term.isActive
                      ? t("moderationAdmin.actions.deactivate")
                      : t("moderationAdmin.actions.activate")
                  }
                  className="w-full text-xs!"
                >
                  {term.isActive
                    ? t("moderationAdmin.actions.deactivate")
                    : t("moderationAdmin.actions.activate")}
                </Button>

                <Button
                  type="button"
                  variant="error"
                  size="sm"
                  onClick={() => setDeleteTarget(term)}
                  disabled={submitting}
                  label={t("moderationAdmin.actions.delete")}
                  className="w-full text-xs!"
                >
                  {t("moderationAdmin.actions.delete")}
                </Button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Desktop table */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-left text-[var(--text1)]">
          <thead>
            <tr className="border-b border-[var(--text1)]/10">
              <th className="py-3 pr-4">{t("moderationAdmin.table.term")}</th>
              <th className="py-3 pr-4">{t("moderationAdmin.table.category")}</th>
              <th className="py-3 pr-4">{t("moderationAdmin.table.status")}</th>
              <th className="py-3 pr-4">{t("moderationAdmin.table.updated")}</th>
              <th className="py-3 pr-0 text-right">
                {t("moderationAdmin.table.actions")}
              </th>
            </tr>
          </thead>

          <tbody>
            {filteredTerms.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center opacity-70">
                  {t("moderationAdmin.states.noTermsFound")}
                </td>
              </tr>
            ) : (
              filteredTerms.map((term) => (
                <tr key={term.id} className="border-b border-[var(--text1)]/10">
                  <td className="py-4 pr-4 font-semibold break-words">{term.term}</td>
                  <td className="py-4 pr-4">
                    {term.category
                      ? t(`moderationAdmin.categories.${term.category}`)
                      : "—"}
                  </td>
                  <td className="py-4 pr-4">
                    <span
                      className={`rounded-full px-3 py-1 text-sm ${
                        term.isActive
                          ? "bg-[var(--success)] text-green-100"
                          : "bg-[var(--button2)] text-[var(--text2)]"
                      }`}
                    >
                      {term.isActive
                        ? t("moderationAdmin.filters.active")
                        : t("moderationAdmin.filters.inactive")}
                    </span>
                  </td>
                  <td className="py-4 pr-4 text-sm opacity-70">
                    {new Date(term.updatedAt).toLocaleString()}
                  </td>
                  <td className="py-4 pr-0">
                    <div className="flex justify-end gap-2 flex-wrap">
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => openEditModal(term)}
                        disabled={submitting}
                        label={t("moderationAdmin.actions.edit")}
                      >
                        {t("moderationAdmin.actions.edit")}
                      </Button>

                      <Button
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => handleToggleActive(term)}
                        disabled={submitting}
                        label={
                          term.isActive
                            ? t("moderationAdmin.actions.deactivate")
                            : t("moderationAdmin.actions.activate")
                        }
                      >
                        {term.isActive
                          ? t("moderationAdmin.actions.deactivate")
                          : t("moderationAdmin.actions.activate")}
                      </Button>

                      <Button
                        type="button"
                        variant="error"
                        size="sm"
                        onClick={() => setDeleteTarget(term)}
                        disabled={submitting}
                        label={t("moderationAdmin.actions.delete")}
                      >
                        {t("moderationAdmin.actions.delete")}
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  </div>
);
};

export default ModerationPanel;
