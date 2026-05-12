const sampleQuestions = [
  {
    question: "Java là ngôn ngữ lập trình được phát triển bởi công ty nào?",
    options: ["Microsoft", "Sun Microsystems", "Apple", "IBM"],
    answer: 1
  },
  {
    question: "Từ khóa nào dùng để tạo lớp trong Java?",
    options: ["class", "function", "define", "struct"],
    answer: "class"
  },
  {
    question: "Kiểu dữ liệu nào lưu giá trị đúng/sai?",
    options: ["int", "String", "boolean", "double"],
    answer: 2
  }
];

const HISTORY_STORAGE_KEY = "eduQuizPro.results.v1";
const MAX_HISTORY_ITEMS = 10;

const state = {
  questions: [],
  answers: [],
  currentIndex: 0,
  submitted: false,
  timeLimitMinutes: 15,
  remainingSeconds: 15 * 60,
  timerId: null,
  timeExpired: false,
  startedAt: null,
  currentQuizName: "Quiz",
  reviewFilter: "all",
  resultStats: null,
  history: []
};

const elements = {
  uploadView: document.querySelector("#uploadView"),
  quizView: document.querySelector("#quizView"),
  resultView: document.querySelector("#resultView"),
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  chooseFileButton: document.querySelector("#chooseFileButton"),
  timeLimitInput: document.querySelector("#timeLimitInput"),
  timePresets: document.querySelectorAll(".time-preset"),
  errorMessage: document.querySelector("#errorMessage"),
  resetButton: document.querySelector("#resetButton"),
  dashboardNav: document.querySelector("#dashboardNav"),
  resultsNav: document.querySelector("#resultsNav"),
  questionMap: document.querySelector("#questionMap"),
  progressText: document.querySelector("#progressText"),
  answeredText: document.querySelector("#answeredText"),
  progressBar: document.querySelector("#progressBar"),
  questionNumber: document.querySelector("#questionNumber"),
  questionStatus: document.querySelector("#questionStatus"),
  questionText: document.querySelector("#questionText"),
  optionsList: document.querySelector("#optionsList"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  submitButton: document.querySelector("#submitButton"),
  timerPill: document.querySelector("#timerPill"),
  scorePercent: document.querySelector("#scorePercent"),
  scoreRing: document.querySelector("#scoreRing"),
  scoreLabel: document.querySelector("#scoreLabel"),
  correctText: document.querySelector("#correctText"),
  incorrectText: document.querySelector("#incorrectText"),
  speedText: document.querySelector("#speedText"),
  allReviewTab: document.querySelector("#allReviewTab"),
  wrongReviewTab: document.querySelector("#wrongReviewTab"),
  resultDetail: document.querySelector("#resultDetail"),
  reviewButton: document.querySelector("#reviewButton"),
  retryButton: document.querySelector("#retryButton"),
  reviewList: document.querySelector("#reviewList"),
  historyPanel: document.querySelector("#historyPanel"),
  historyList: document.querySelector("#historyList"),
  clearHistoryButton: document.querySelector("#clearHistoryButton")
};

function showError(message) {
  elements.errorMessage.textContent = message;
}

function clearError() {
  elements.errorMessage.textContent = "";
}

function setActiveNav(view) {
  elements.dashboardNav.classList.toggle("active", view !== "result");
  elements.resultsNav.classList.toggle("active", view === "result");
}

function loadHistory() {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(HISTORY_STORAGE_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === "object") : [];
  } catch {
    return [];
  }
}

function persistHistory() {
  try {
    window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(state.history.slice(0, MAX_HISTORY_ITEMS)));
  } catch {
    const compactHistory = state.history.slice(0, 3).map((entry) => ({
      ...entry,
      questions: [],
      answers: []
    }));
    state.history = compactHistory;
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(compactHistory));
    } catch {
      state.history = [];
    }
  }
}

function saveHistoryEntry(entry) {
  state.history = [
    entry,
    ...state.history.filter((item) => item.id !== entry.id)
  ].slice(0, MAX_HISTORY_ITEMS);
  persistHistory();
}

function clearHistory() {
  state.history = [];
  window.localStorage.removeItem(HISTORY_STORAGE_KEY);
  renderHistory();
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  return `${minutes}:${String(secs).padStart(2, "0")}`;
}

function formatDuration(seconds) {
  const safeSeconds = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const secs = safeSeconds % 60;

  if (minutes > 0) return `${minutes}m ${secs}s`;
  return `${secs}s`;
}

function formatSpeed(secondsPerQuestion) {
  return `${formatDuration(secondsPerQuestion)} / qst`;
}

function updateTimerDisplay() {
  elements.timerPill.textContent = `${formatTime(state.remainingSeconds)} Remaining`;
  elements.timerPill.classList.toggle("is-warning", state.remainingSeconds <= 60 && !state.submitted);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startTimer() {
  stopTimer();
  state.timeExpired = false;
  state.startedAt = Date.now();
  state.remainingSeconds = state.timeLimitMinutes * 60;
  updateTimerDisplay();

  state.timerId = window.setInterval(() => {
    state.remainingSeconds -= 1;
    updateTimerDisplay();

    if (state.remainingSeconds <= 0) {
      stopTimer();
      state.timeExpired = true;
      submitQuiz({ skipConfirm: true });
    }
  }, 1000);
}

function readTimeLimit() {
  const rawMinutes = Number(elements.timeLimitInput.value);
  const minutes = Number.isFinite(rawMinutes) ? Math.round(rawMinutes) : 15;
  return Math.min(180, Math.max(1, minutes));
}

function setTimeLimit(minutes) {
  state.timeLimitMinutes = Math.min(180, Math.max(1, Math.round(minutes)));
  state.remainingSeconds = state.timeLimitMinutes * 60;
  elements.timeLimitInput.value = String(state.timeLimitMinutes);
  elements.timePresets.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.minutes) === state.timeLimitMinutes);
  });
  updateTimerDisplay();
}

function readQuestionText(item, index) {
  const text = item.question ?? item.text ?? item.title ?? item.prompt;
  if (typeof text !== "string" || !text.trim()) {
    throw new Error(`Câu ${index + 1} thiếu nội dung câu hỏi.`);
  }
  return text.trim();
}

function readOptions(item, index) {
  const rawOptions = item.options ?? item.choices ?? item.answers;
  if (!Array.isArray(rawOptions) || rawOptions.length < 2) {
    throw new Error(`Câu ${index + 1} cần ít nhất 2 lựa chọn.`);
  }
  return rawOptions.map((option, optionIndex) => {
    if (typeof option === "string" || typeof option === "number" || typeof option === "boolean") {
      return String(option);
    }

    if (option && typeof option === "object") {
      const value = option.text ?? option.label ?? option.value ?? option.answer;
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        return String(value);
      }
    }

    throw new Error(`Lựa chọn ${optionIndex + 1} của câu ${index + 1} không hợp lệ.`);
  });
}

function readAnswer(item, options, index) {
  const answer = item.answer ?? item.correct ?? item.correctAnswer ?? item.correctIndex;
  if (answer === undefined || answer === null) {
    throw new Error(`Câu ${index + 1} thiếu đáp án đúng.`);
  }

  if (Number.isInteger(answer)) {
    if (answer >= 0 && answer < options.length) return answer;
    if (answer >= 1 && answer <= options.length) return answer - 1;
  }

  if (typeof answer === "string") {
    const trimmed = answer.trim();
    const letterIndex = trimmed.toUpperCase().charCodeAt(0) - 65;
    if (trimmed.length === 1 && letterIndex >= 0 && letterIndex < options.length) {
      return letterIndex;
    }

    const exactIndex = options.findIndex((option) => option.trim().toLowerCase() === trimmed.toLowerCase());
    if (exactIndex !== -1) return exactIndex;

    const numericIndex = Number(trimmed);
    if (Number.isInteger(numericIndex)) {
      if (numericIndex >= 0 && numericIndex < options.length) return numericIndex;
      if (numericIndex >= 1 && numericIndex <= options.length) return numericIndex - 1;
    }
  }

  throw new Error(`Đáp án đúng của câu ${index + 1} không khớp với lựa chọn nào.`);
}

function getRawQuestions(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data.questions)) return data.questions;
  if (Array.isArray(data.items)) return data.items;
  if (Array.isArray(data.data)) return data.data;

  if (Array.isArray(data.chapters)) {
    return data.chapters.flatMap((chapter, chapterIndex) => {
      if (!Array.isArray(chapter.questions)) return [];

      const chapterName = chapter.chapter ?? `Chương ${chapterIndex + 1}`;
      const chapterTitle = chapter.title ? `${chapterName} - ${chapter.title}` : chapterName;
      return chapter.questions.map((question) => ({
        ...question,
        chapterTitle
      }));
    });
  }

  return null;
}

function normalizeQuestions(data) {
  const rawQuestions = getRawQuestions(data);
  if (!Array.isArray(rawQuestions) || rawQuestions.length === 0) {
    throw new Error("File JSON phải là mảng câu hỏi, object có trường questions, hoặc object có chapters[].questions.");
  }

  return rawQuestions.map((item, index) => {
    if (!item || typeof item !== "object") {
      throw new Error(`Câu ${index + 1} không phải object hợp lệ.`);
    }

    const text = readQuestionText(item, index);
    const options = readOptions(item, index);
    const answer = readAnswer(item, options, index);

    return {
      text,
      options,
      answer,
      chapterTitle: typeof item.chapterTitle === "string" ? item.chapterTitle : "",
      explanation: typeof item.explanation_vi === "string" ? item.explanation_vi : ""
    };
  });
}

function loadQuestions(questions, quizName = "Quiz") {
  state.questions = questions;
  state.answers = Array.from({ length: questions.length }, () => null);
  state.currentIndex = 0;
  state.submitted = false;
  state.timeExpired = false;
  state.currentQuizName = quizName;
  state.reviewFilter = "all";
  state.resultStats = null;
  setTimeLimit(readTimeLimit());
  elements.uploadView.hidden = true;
  elements.resultView.hidden = true;
  elements.quizView.hidden = false;
  elements.submitButton.hidden = false;
  elements.resetButton.hidden = false;
  setActiveNav("quiz");
  startTimer();
  renderQuiz();
}

async function handleFile(file) {
  clearError();

  if (!file) return;
  if (!file.name.toLowerCase().endsWith(".json") && file.type !== "application/json") {
    showError("Vui lòng chọn file .json.");
    return;
  }

  try {
    const content = await file.text();
    const data = JSON.parse(content);
    loadQuestions(normalizeQuestions(data), file.name);
  } catch (error) {
    showError(error.message || "Không đọc được file JSON.");
  } finally {
    elements.fileInput.value = "";
  }
}

function renderQuestionMap() {
  elements.questionMap.innerHTML = "";
  state.questions.forEach((_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "map-button";
    button.textContent = String(index + 1);
    button.ariaLabel = `Đến câu ${index + 1}`;
    if (index === state.currentIndex) button.classList.add("current");
    if (state.answers[index] !== null) button.classList.add("answered");
    button.addEventListener("click", () => {
      state.currentIndex = index;
      renderQuiz();
    });
    elements.questionMap.append(button);
  });
}

function looksLikeCode(text) {
  return /[\n\r]/.test(text) || /\b(public|class|static|void|new|Thread|Runnable|System\.out|import|synchronized|try|catch)\b|[{};<>]/.test(text);
}

function renderQuestionText(text) {
  const codeFencePattern = /```[^\n\r]*[\r\n]+([\s\S]*?)```/g;
  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = codeFencePattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: "text", value: text.slice(lastIndex, match.index).trim() });
    }
    parts.push({ type: "code", value: match[1].trim() });
    lastIndex = codeFencePattern.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ type: "text", value: text.slice(lastIndex).trim() });
  }

  if (parts.length === 1 && parts[0].type === "text" && /[\n\r]/.test(text) && looksLikeCode(text)) {
    parts[0].type = "code";
  }

  elements.questionText.innerHTML = "";
  elements.questionText.classList.toggle("has-code", parts.some((part) => part.type === "code"));

  if (parts.length === 0 || !parts.some((part) => part.value)) {
    elements.questionText.textContent = text;
    return;
  }

  parts
    .filter((part) => part.value)
    .forEach((part) => {
      if (part.type === "code") {
        const pre = document.createElement("pre");
        pre.className = "question-code code-content";
        const code = document.createElement("code");
        code.textContent = part.value;
        pre.append(code);
        elements.questionText.append(pre);
        return;
      }

      const block = document.createElement("div");
      block.className = "question-copy";
      block.textContent = part.value;
      elements.questionText.append(block);
    });
}

function renderQuiz() {
  const question = state.questions[state.currentIndex];
  const answeredCount = state.answers.filter((answer) => answer !== null).length;
  const completedPercent = Math.round(((state.currentIndex + 1) / state.questions.length) * 100);
  const answerPercent = Math.round((answeredCount / state.questions.length) * 100);

  elements.progressText.textContent = `Progress: ${state.currentIndex + 1}/${state.questions.length} Questions`;
  elements.answeredText.textContent = `${completedPercent}% Completed`;
  elements.progressBar.style.width = `${completedPercent}%`;
  elements.questionNumber.textContent = question.chapterTitle
    ? `${question.chapterTitle} · Question ${state.currentIndex + 1}`
    : `Question ${state.currentIndex + 1}`;
  elements.questionStatus.textContent = state.answers[state.currentIndex] === null ? "Difficulty: Medium" : `Answered: ${answerPercent}%`;
  renderQuestionText(question.text);
  elements.prevButton.disabled = state.currentIndex === 0;
  elements.nextButton.disabled = state.currentIndex === state.questions.length - 1;

  elements.optionsList.innerHTML = "";
  question.options.forEach((option, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "option-button";
    if (state.answers[state.currentIndex] === index) button.classList.add("selected");
    const marker = document.createElement("span");
    marker.className = "option-marker";
    marker.textContent = String.fromCharCode(65 + index);

    const optionText = document.createElement("span");
    optionText.className = "option-text";
    optionText.textContent = option;
    optionText.classList.toggle("code-content", looksLikeCode(option));

    const check = document.createElement("span");
    check.className = "option-check";
    check.textContent = "✓";

    button.append(marker, optionText, check);
    button.addEventListener("click", () => {
      state.answers[state.currentIndex] = index;
      renderQuiz();
    });
    elements.optionsList.append(button);
  });

  renderQuestionMap();
}

function calculateScore() {
  return state.questions.reduce((score, question, index) => {
    return score + (state.answers[index] === question.answer ? 1 : 0);
  }, 0);
}

function getElapsedSeconds() {
  const limitSeconds = state.timeLimitMinutes * 60;
  if (state.timeExpired) return limitSeconds;

  const elapsedByClock = state.startedAt ? Math.round((Date.now() - state.startedAt) / 1000) : 0;
  const elapsedByTimer = limitSeconds - state.remainingSeconds;
  return Math.max(0, Math.min(limitSeconds, Math.max(elapsedByClock, elapsedByTimer)));
}

function buildResultStats() {
  const score = calculateScore();
  const questionCount = state.questions.length;
  const percent = Math.round((score / questionCount) * 100);
  const incorrect = questionCount - score;
  const elapsedSeconds = getElapsedSeconds();

  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    quizName: state.currentQuizName,
    score,
    percent,
    incorrect,
    questionCount,
    elapsedSeconds,
    speedSeconds: questionCount > 0 && elapsedSeconds > 0 ? Math.max(1, Math.round(elapsedSeconds / questionCount)) : 0,
    timeLimitMinutes: state.timeLimitMinutes,
    timeExpired: state.timeExpired,
    questions: state.questions,
    answers: state.answers
  };
}

function renderResult(stats) {
  state.resultStats = stats;
  elements.quizView.hidden = true;
  elements.uploadView.hidden = true;
  elements.resultView.hidden = false;
  elements.submitButton.hidden = true;
  elements.scorePercent.textContent = `${stats.percent}%`;
  elements.scoreLabel.textContent = stats.percent >= 80 ? "Excellent" : stats.percent >= 50 ? "Good" : "Review";
  elements.scoreRing.style.setProperty("--score-angle", `${stats.percent * 3.6}deg`);
  elements.correctText.textContent = `${String(stats.score).padStart(2, "0")} / ${stats.questionCount}`;
  elements.incorrectText.textContent = `${String(stats.incorrect).padStart(2, "0")} / ${stats.questionCount}`;
  elements.speedText.textContent = formatSpeed(stats.speedSeconds);
  elements.allReviewTab.textContent = `All (${stats.questionCount})`;
  elements.wrongReviewTab.textContent = `Incorrect (${stats.incorrect})`;
  elements.resultDetail.textContent = `Bạn trả lời đúng ${stats.score} trên tổng số ${stats.questionCount} câu trong ${formatDuration(stats.elapsedSeconds)}.`;
  if (stats.timeExpired) {
    elements.resultDetail.textContent = `Hết giờ. Bài đã được tự động nộp. Bạn trả lời đúng ${stats.score} trên tổng số ${stats.questionCount} câu.`;
  }
  setActiveNav("result");
  renderReview();
  renderHistory();
}

function openHistoryEntry(entry) {
  if (!entry || !Array.isArray(entry.questions) || !Array.isArray(entry.answers) || entry.questions.length === 0) {
    showError("Kết quả này chỉ còn thông tin tóm tắt, không đủ dữ liệu để xem lại câu hỏi.");
    return;
  }

  stopTimer();
  state.questions = entry.questions;
  state.answers = entry.answers;
  state.currentIndex = 0;
  state.submitted = true;
  state.timeExpired = Boolean(entry.timeExpired);
  state.timeLimitMinutes = entry.timeLimitMinutes || state.timeLimitMinutes;
  state.remainingSeconds = Math.max(0, state.timeLimitMinutes * 60 - (entry.elapsedSeconds || 0));
  state.currentQuizName = entry.quizName || "Quiz";
  state.reviewFilter = "all";
  updateTimerDisplay();
  renderResult(entry);
}

function renderHistory() {
  if (!elements.historyPanel || !elements.historyList) return;

  elements.historyPanel.hidden = state.history.length === 0;
  elements.historyList.innerHTML = "";

  state.history.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "history-item";
    if (state.resultStats && entry.id === state.resultStats.id) item.classList.add("active");

    const info = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = entry.quizName || "Quiz";
    const meta = document.createElement("span");
    const createdAt = entry.createdAt ? new Date(entry.createdAt).toLocaleString("vi-VN") : "";
    meta.textContent = `${createdAt} | ${entry.score}/${entry.questionCount} | ${formatSpeed(entry.speedSeconds || 0)}`;
    info.append(title, meta);

    const openButton = document.createElement("button");
    openButton.className = "secondary-button";
    openButton.type = "button";
    openButton.textContent = "Open";
    openButton.addEventListener("click", () => openHistoryEntry(entry));

    item.append(info, openButton);
    elements.historyList.append(item);
  });
}

function submitQuiz(options = {}) {
  if (state.submitted) return;

  const unanswered = state.answers.filter((answer) => answer === null).length;
  if (!options.skipConfirm && unanswered > 0) {
    const ok = window.confirm(`Bạn còn ${unanswered} câu chưa trả lời. Bạn vẫn muốn nộp bài?`);
    if (!ok) return;
  }

  stopTimer();
  const stats = buildResultStats();
  state.submitted = true;
  state.remainingSeconds = Math.max(0, state.timeLimitMinutes * 60 - stats.elapsedSeconds);
  updateTimerDisplay();
  saveHistoryEntry(stats);
  renderResult(stats);
}

function renderReview() {
  elements.reviewList.innerHTML = "";
  elements.allReviewTab.classList.toggle("active", state.reviewFilter === "all");
  elements.wrongReviewTab.classList.toggle("active", state.reviewFilter === "wrong");

  const questionsToRender = state.questions
    .map((question, index) => ({
      question,
      index,
      isCorrect: state.answers[index] === question.answer
    }))
    .filter((item) => state.reviewFilter === "all" || !item.isCorrect);

  if (questionsToRender.length === 0) {
    const empty = document.createElement("p");
    empty.className = "review-empty";
    empty.textContent = "Không có câu sai.";
    elements.reviewList.append(empty);
    return;
  }

  questionsToRender.forEach(({ question, index, isCorrect }) => {
    const item = document.createElement("article");
    item.className = "review-item";
    if (!isCorrect) item.classList.add("wrong");

    const title = document.createElement("h3");
    const status = document.createElement("span");
    status.className = "review-status";
    status.textContent = isCorrect ? "✓ Correct" : "× Incorrect";
    title.append(status, document.createTextNode(`Question ${index + 1}`), document.createElement("br"), document.createTextNode(question.text));
    item.append(title);

    const options = document.createElement("div");
    options.className = "review-options";

    question.options.forEach((option, optionIndex) => {
      const choice = document.createElement("p");
      choice.className = "review-choice";
      if (optionIndex === question.answer) choice.classList.add("correct");
      if (optionIndex === state.answers[index] && optionIndex !== question.answer) choice.classList.add("wrong");

      const prefix = String.fromCharCode(65 + optionIndex);
      const letter = document.createElement("span");
      letter.className = "choice-letter";
      letter.textContent = prefix;
      const text = document.createElement("span");
      text.textContent = option;
      const mark = document.createElement("span");
      mark.textContent = optionIndex === question.answer ? "✓" : optionIndex === state.answers[index] ? "×" : "";
      choice.append(letter, text, mark);
      choice.classList.toggle("code-content", looksLikeCode(option));
      options.append(choice);
    });

    item.append(options);

    const explanation = document.createElement("p");
    explanation.className = "review-note";
    explanation.textContent = question.explanation
      ? `${isCorrect ? "Explanation" : "Correction"}: ${question.explanation}`
      : isCorrect
        ? "Explanation: Bạn đã chọn đúng đáp án cho câu này."
        : `Correction: Đáp án đúng là ${String.fromCharCode(65 + question.answer)}. ${question.options[question.answer]}`;
    item.append(explanation);

    elements.reviewList.append(item);
  });
}

function resetToUpload() {
  stopTimer();
  state.questions = [];
  state.answers = [];
  state.currentIndex = 0;
  state.submitted = false;
  state.timeExpired = false;
  state.reviewFilter = "all";
  state.resultStats = null;
  setTimeLimit(readTimeLimit());
  elements.uploadView.hidden = false;
  elements.quizView.hidden = true;
  elements.resultView.hidden = true;
  elements.resetButton.hidden = true;
  elements.submitButton.hidden = true;
  setActiveNav("upload");
  clearError();
}

function retryQuiz() {
  state.answers = Array.from({ length: state.questions.length }, () => null);
  state.currentIndex = 0;
  state.submitted = false;
  state.timeExpired = false;
  state.reviewFilter = "all";
  state.resultStats = null;
  startTimer();
  elements.resultView.hidden = true;
  elements.quizView.hidden = false;
  elements.submitButton.hidden = false;
  setActiveNav("quiz");
  renderQuiz();
}

elements.fileInput.addEventListener("change", (event) => handleFile(event.target.files[0]));
elements.chooseFileButton.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  elements.fileInput.click();
});
elements.timeLimitInput.closest(".time-settings").addEventListener("click", (event) => {
  event.stopPropagation();
});
elements.timeLimitInput.addEventListener("change", () => setTimeLimit(readTimeLimit()));
elements.timeLimitInput.addEventListener("input", () => {
  elements.timePresets.forEach((button) => {
    button.classList.toggle("active", Number(button.dataset.minutes) === Number(elements.timeLimitInput.value));
  });
});
elements.timePresets.forEach((button) => {
  button.addEventListener("click", () => setTimeLimit(Number(button.dataset.minutes)));
});
elements.dropZone.addEventListener("click", () => elements.fileInput.click());
elements.resetButton.addEventListener("click", resetToUpload);
elements.dashboardNav.addEventListener("click", () => {
  if (state.questions.length && !state.submitted) {
    elements.uploadView.hidden = true;
    elements.resultView.hidden = true;
    elements.quizView.hidden = false;
    elements.submitButton.hidden = false;
    setActiveNav("quiz");
    return;
  }
  resetToUpload();
});
elements.resultsNav.addEventListener("click", () => {
  if (!state.submitted) {
    if (state.history.length > 0) {
      openHistoryEntry(state.history[0]);
    }
    return;
  }
  elements.uploadView.hidden = true;
  elements.quizView.hidden = true;
  elements.resultView.hidden = false;
  elements.submitButton.hidden = true;
  setActiveNav("result");
  renderHistory();
});
elements.prevButton.addEventListener("click", () => {
  state.currentIndex = Math.max(0, state.currentIndex - 1);
  renderQuiz();
});
elements.nextButton.addEventListener("click", () => {
  state.currentIndex = Math.min(state.questions.length - 1, state.currentIndex + 1);
  renderQuiz();
});
elements.submitButton.addEventListener("click", submitQuiz);
elements.retryButton.addEventListener("click", retryQuiz);
elements.reviewButton.addEventListener("click", () => {
  state.reviewFilter = "all";
  renderReview();
});
elements.allReviewTab.addEventListener("click", () => {
  state.reviewFilter = "all";
  renderReview();
});
elements.wrongReviewTab.addEventListener("click", () => {
  state.reviewFilter = "wrong";
  renderReview();
});
elements.clearHistoryButton.addEventListener("click", clearHistory);

["dragenter", "dragover"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((eventName) => {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
  });
});

elements.dropZone.addEventListener("drop", (event) => {
  handleFile(event.dataTransfer.files[0]);
});

state.history = loadHistory();
setTimeLimit(state.timeLimitMinutes);
