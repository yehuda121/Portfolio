import React, { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  adminCreateQuestion,
  adminDeleteQuestion,
  adminListQuestions,
  adminToggleQuestionActive,
  adminUpdateQuestion,
} from "../../api/quizApi";
import AdminShell from "./AdminShell";
import InlineAlert from "../../components/ui/InlineAlert/InlineAlert";
import LoadingSpinner from "../../components/ui/LoadingSpinner/LoadingSpinner";
import Modal from "../../components/ui/Modal/Modal";
import { useToast } from "../../components/ui/Toast/ToastProvider";

const CATEGORIES = ["oop", "data_structures", "algorithms"];
const DIFFICULTIES = ["junior", "mid", "senior"];

const EMPTY_FORM = {
  questionId: "",
  category: "oop",
  difficulty: "junior",
  isActive: true,
  questionText: { en: "", he: "" },
  answers: { en: ["", "", "", ""], he: ["", "", "", ""] },
  correctIndex: 0,
  explanation: { en: "", he: "" },
};

function validateForm(form, t) {
  const errors = {};
  if (!form.questionId?.trim()) errors.questionId = t("Quiz.admin.validation.questionId");
  if (!form.questionText.en?.trim()) errors.questionTextEn = t("Quiz.admin.validation.questionTextEn");
  if (!form.questionText.he?.trim()) errors.questionTextHe = t("Quiz.admin.validation.questionTextHe");
  if (!form.explanation.en?.trim()) errors.explanationEn = t("Quiz.admin.validation.explanationEn");
  if (!form.explanation.he?.trim()) errors.explanationHe = t("Quiz.admin.validation.explanationHe");
  ["en", "he"].forEach((lang) => {
    form.answers[lang].forEach((ans, i) => {
      if (!ans?.trim()) errors[`answer_${lang}_${i}`] = t("Quiz.admin.validation.answerRequired");
    });
  });
  if (![0, 1, 2, 3].includes(Number(form.correctIndex))) {
    errors.correctIndex = t("Quiz.admin.validation.correctIndex");
  }
  return errors;
}

const AdminQuestionsPage = () => {
  const { t, i18n } = useTranslation();
  const { showSuccess, showError } = useToast();
  const lang = i18n.language?.startsWith("he") ? "he" : "en";

  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterDifficulty, setFilterDifficulty] = useState("");
  const [filterActive, setFilterActive] = useState("");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => clearTimeout(handle);
  }, [search]);

  const loadQuestions = useCallback(async () => {
    setLoading(true);
    setListError(null);
    const result = await adminListQuestions({
      category: filterCategory || undefined,
      difficulty: filterDifficulty || undefined,
      active: filterActive || undefined,
      search: debouncedSearch || undefined,
    });
    setLoading(false);

    if (!result.ok) {
      setListError(t("Quiz.admin.errors.loadFailed"));
      return;
    }
    setQuestions(result.data?.questions || []);
  }, [filterCategory, filterDifficulty, filterActive, debouncedSearch, t]);

  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const openCreate = () => {
    setEditing(false);
    setForm({ ...EMPTY_FORM, questionId: `${form.category || "oop"}-custom-${Date.now()}` });
    setFormErrors({});
    setFormOpen(true);
  };

  const openEdit = (q) => {
    setEditing(true);
    const enAnswers = [...(q.answers?.en || [])];
    const heAnswers = [...(q.answers?.he || [])];
    while (enAnswers.length < 4) enAnswers.push("");
    while (heAnswers.length < 4) heAnswers.push("");
    setForm({
      questionId: q.questionId,
      category: q.category,
      difficulty: q.difficulty,
      isActive: q.isActive,
      questionText: { en: q.questionText?.en || "", he: q.questionText?.he || "" },
      answers: { en: enAnswers.slice(0, 4), he: heAnswers.slice(0, 4) },
      correctIndex: q.correctIndex,
      explanation: { en: q.explanation?.en || "", he: q.explanation?.he || "" },
    });
    setFormErrors({});
    setFormOpen(true);
  };

  const updateFormField = (path, value) => {
    setForm((prev) => {
      const next = { ...prev };
      if (path === "questionText.en") next.questionText = { ...prev.questionText, en: value };
      else if (path === "questionText.he") next.questionText = { ...prev.questionText, he: value };
      else if (path === "explanation.en") next.explanation = { ...prev.explanation, en: value };
      else if (path === "explanation.he") next.explanation = { ...prev.explanation, he: value };
      else if (path.startsWith("answers.")) {
        const [, langKey, idx] = path.split(".");
        const answers = { ...prev.answers, [langKey]: [...prev.answers[langKey]] };
        answers[langKey][Number(idx)] = value;
        next.answers = answers;
      } else {
        next[path] = value;
      }
      return next;
    });
  };

  const saveQuestion = async (e) => {
    e.preventDefault();
    const errors = validateForm(form, t);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;

    setSaving(true);
    const payload = {
      questionId: form.questionId.trim(),
      category: form.category,
      difficulty: form.difficulty,
      isActive: !!form.isActive,
      questionText: {
        en: form.questionText.en.trim(),
        he: form.questionText.he.trim(),
      },
      answers: {
        en: form.answers.en.map((a) => a.trim()),
        he: form.answers.he.map((a) => a.trim()),
      },
      correctIndex: Number(form.correctIndex),
      explanation: {
        en: form.explanation.en.trim(),
        he: form.explanation.he.trim(),
      },
    };

    const result = editing
      ? await adminUpdateQuestion(form.questionId, payload)
      : await adminCreateQuestion(payload);

    setSaving(false);

    if (!result.ok) {
      showError(t("Quiz.admin.errors.saveFailed"));
      return;
    }

    showSuccess(t("Quiz.admin.saved"));
    setFormOpen(false);
    loadQuestions();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    const result = await adminDeleteQuestion(deleteTarget.questionId);
    setDeleteTarget(null);
    if (!result.ok) {
      showError(t("Quiz.admin.errors.deleteFailed"));
      return;
    }
    showSuccess(t("Quiz.admin.deleted"));
    loadQuestions();
  };

  const toggleActive = async (q) => {
    const result = await adminToggleQuestionActive(q.questionId);
    if (!result.ok) {
      showError(t("Quiz.admin.errors.toggleFailed"));
      return;
    }
    loadQuestions();
  };

  return (
    <AdminShell
      title={t("Quiz.admin.title")}
      subtitle={t("Quiz.admin.subtitle")}
      backTo="/Admin"
      backLabel={t("Admin.backToDashboard")}
    >
      <div className="quiz-card">
        <div className="quiz-admin-toolbar">
          <select className="quiz-select" value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
            <option value="">{t("Quiz.admin.allCategories")}</option>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>{t(`Quiz.category${c === "oop" ? "OOP" : c === "data_structures" ? "DataStructures" : "Algorithms"}`)}</option>
            ))}
          </select>
          <select className="quiz-select" value={filterDifficulty} onChange={(e) => setFilterDifficulty(e.target.value)}>
            <option value="">{t("Quiz.admin.allDifficulties")}</option>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>{t(`Quiz.${d}`)}</option>
            ))}
          </select>
          <select className="quiz-select" value={filterActive} onChange={(e) => setFilterActive(e.target.value)}>
            <option value="">{t("Quiz.admin.allStatuses")}</option>
            <option value="true">{t("Quiz.admin.active")}</option>
            <option value="false">{t("Quiz.admin.inactive")}</option>
          </select>
          <input
            className="quiz-admin-input quiz-admin-search"
            placeholder={t("Quiz.admin.searchPlaceholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button type="button" className="quiz-start-btn" onClick={openCreate}>{t("Quiz.admin.addQuestion")}</button>
        </div>

        {listError && <InlineAlert type="error" message={listError} />}
        {loading && <LoadingSpinner label={t("Quiz.loading")} />}

        {!loading && questions.length === 0 && (
          <div className="quiz-admin-empty">{t("Quiz.admin.empty")}</div>
        )}

        {!loading && questions.length > 0 && (
          <div className="quiz-admin-table-wrap">
            <table className="quiz-admin-table">
              <thead>
                <tr>
                  <th>{t("Quiz.admin.table.id")}</th>
                  <th>{t("Quiz.admin.table.category")}</th>
                  <th>{t("Quiz.admin.table.difficulty")}</th>
                  <th>{t("Quiz.admin.table.question")}</th>
                  <th>{t("Quiz.admin.table.status")}</th>
                  <th>{t("Quiz.admin.table.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {questions.map((q) => (
                  <tr key={q.questionId}>
                    <td className="quiz-admin-id" title={q.questionId}>
                      {q.questionId}
                    </td>
                    <td className="quiz-admin-meta">{t(`Quiz.category${q.category === "oop" ? "OOP" : q.category === "data_structures" ? "DataStructures" : "Algorithms"}`)}</td>
                    <td className="quiz-admin-meta">{t(`Quiz.${q.difficulty}`)}</td>
                    <td
                      className="quiz-admin-question"
                      title={q.questionText?.[lang] || q.questionText?.en || ""}
                    >
                      {q.questionText?.[lang] || q.questionText?.en}
                    </td>
                    <td>
                      <span className={q.isActive ? "quiz-admin-badge-active" : "quiz-admin-badge-inactive"}>
                        {q.isActive ? t("Quiz.admin.active") : t("Quiz.admin.inactive")}
                      </span>
                    </td>
                    <td className="quiz-admin-actions">
                      <button type="button" className="quiz-next-btn" onClick={() => openEdit(q)}>{t("Quiz.admin.edit")}</button>
                      <button type="button" className="quiz-next-btn" onClick={() => toggleActive(q)}>
                        {q.isActive ? t("Quiz.admin.deactivate") : t("Quiz.admin.activate")}
                      </button>
                      <button type="button" className="quiz-next-btn quiz-admin-delete-btn" onClick={() => setDeleteTarget(q)}>
                        {t("Quiz.admin.delete")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {formOpen && (
        <div className="quiz-admin-form-overlay" role="presentation" onClick={() => setFormOpen(false)}>
          <div className="quiz-admin-form-panel" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h3>{editing ? t("Quiz.admin.editQuestion") : t("Quiz.admin.addQuestion")}</h3>
            <form onSubmit={saveQuestion} className="quiz-admin-form">
              <div className="quiz-admin-form-grid">
                <label className="quiz-admin-label">
                  {t("Quiz.admin.form.questionId")}
                  <input className="quiz-admin-input" value={form.questionId} onChange={(e) => updateFormField("questionId", e.target.value)} disabled={editing} />
                  {formErrors.questionId && <span className="quiz-admin-field-error">{formErrors.questionId}</span>}
                </label>
                <label className="quiz-admin-label">
                  {t("Quiz.admin.form.category")}
                  <select className="quiz-select" value={form.category} onChange={(e) => updateFormField("category", e.target.value)}>
                    {CATEGORIES.map((c) => (
                      <option key={c} value={c}>{t(`Quiz.category${c === "oop" ? "OOP" : c === "data_structures" ? "DataStructures" : "Algorithms"}`)}</option>
                    ))}
                  </select>
                </label>
                <label className="quiz-admin-label">
                  {t("Quiz.admin.form.difficulty")}
                  <select className="quiz-select" value={form.difficulty} onChange={(e) => updateFormField("difficulty", e.target.value)}>
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>{t(`Quiz.${d}`)}</option>
                    ))}
                  </select>
                </label>
                <label className="quiz-admin-label">
                  {t("Quiz.admin.form.correctIndex")}
                  <select className="quiz-select" value={form.correctIndex} onChange={(e) => updateFormField("correctIndex", Number(e.target.value))}>
                    {[0, 1, 2, 3].map((i) => (
                      <option key={i} value={i}>{i + 1}</option>
                    ))}
                  </select>
                  {formErrors.correctIndex && <span className="quiz-admin-field-error">{formErrors.correctIndex}</span>}
                </label>
                <label className="quiz-admin-label quiz-admin-checkbox-label">
                  <input type="checkbox" checked={form.isActive} onChange={(e) => updateFormField("isActive", e.target.checked)} />
                  {t("Quiz.admin.form.isActive")}
                </label>
              </div>

              <label className="quiz-admin-label">
                {t("Quiz.admin.form.questionEn")}
                <textarea className="quiz-admin-textarea" value={form.questionText.en} onChange={(e) => updateFormField("questionText.en", e.target.value)} rows={2} />
                {formErrors.questionTextEn && <span className="quiz-admin-field-error">{formErrors.questionTextEn}</span>}
              </label>
              <label className="quiz-admin-label">
                {t("Quiz.admin.form.questionHe")}
                <textarea className="quiz-admin-textarea" value={form.questionText.he} onChange={(e) => updateFormField("questionText.he", e.target.value)} rows={2} dir="rtl" />
                {formErrors.questionTextHe && <span className="quiz-admin-field-error">{formErrors.questionTextHe}</span>}
              </label>

              <div className="quiz-admin-answers-grid">
                <div>
                  <div className="quiz-admin-section-title">{t("Quiz.admin.form.answersEn")}</div>
                  {[0, 1, 2, 3].map((i) => (
                    <label key={`en-${i}`} className="quiz-admin-label">
                      {t("Quiz.admin.form.answerN", { n: i + 1 })}
                      <input className="quiz-admin-input" value={form.answers.en[i]} onChange={(e) => updateFormField(`answers.en.${i}`, e.target.value)} />
                      {formErrors[`answer_en_${i}`] && <span className="quiz-admin-field-error">{formErrors[`answer_en_${i}`]}</span>}
                    </label>
                  ))}
                </div>
                <div>
                  <div className="quiz-admin-section-title">{t("Quiz.admin.form.answersHe")}</div>
                  {[0, 1, 2, 3].map((i) => (
                    <label key={`he-${i}`} className="quiz-admin-label">
                      {t("Quiz.admin.form.answerN", { n: i + 1 })}
                      <input className="quiz-admin-input" value={form.answers.he[i]} onChange={(e) => updateFormField(`answers.he.${i}`, e.target.value)} dir="rtl" />
                      {formErrors[`answer_he_${i}`] && <span className="quiz-admin-field-error">{formErrors[`answer_he_${i}`]}</span>}
                    </label>
                  ))}
                </div>
              </div>

              <label className="quiz-admin-label">
                {t("Quiz.admin.form.explanationEn")}
                <textarea className="quiz-admin-textarea" value={form.explanation.en} onChange={(e) => updateFormField("explanation.en", e.target.value)} rows={3} />
                {formErrors.explanationEn && <span className="quiz-admin-field-error">{formErrors.explanationEn}</span>}
              </label>
              <label className="quiz-admin-label">
                {t("Quiz.admin.form.explanationHe")}
                <textarea className="quiz-admin-textarea" value={form.explanation.he} onChange={(e) => updateFormField("explanation.he", e.target.value)} rows={3} dir="rtl" />
                {formErrors.explanationHe && <span className="quiz-admin-field-error">{formErrors.explanationHe}</span>}
              </label>

              <div className="quiz-admin-form-actions">
                <button type="button" className="quiz-next-btn" onClick={() => setFormOpen(false)}>{t("Quiz.admin.cancel")}</button>
                <button type="submit" className="quiz-start-btn" disabled={saving}>
                  {saving ? t("Quiz.loading") : t("Quiz.admin.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Modal
        open={!!deleteTarget}
        title={t("Quiz.admin.deleteTitle")}
        message={t("Quiz.admin.deleteMessage", { id: deleteTarget?.questionId })}
        confirmLabel={t("Quiz.admin.delete")}
        cancelLabel={t("Quiz.admin.cancel")}
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </AdminShell>
  );
};

export default AdminQuestionsPage;
