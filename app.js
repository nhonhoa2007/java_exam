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

const state = {
  questions: [],
  answers: [],
  currentIndex: 0,
  submitted: false
};

const elements = {
  uploadView: document.querySelector("#uploadView"),
  quizView: document.querySelector("#quizView"),
  resultView: document.querySelector("#resultView"),
  dropZone: document.querySelector("#dropZone"),
  fileInput: document.querySelector("#fileInput"),
  chooseFileButton: document.querySelector("#chooseFileButton"),
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
  scorePercent: document.querySelector("#scorePercent"),
  scoreRing: document.querySelector("#scoreRing"),
  scoreLabel: document.querySelector("#scoreLabel"),
  correctText: document.querySelector("#correctText"),
  incorrectText: document.querySelector("#incorrectText"),
  allReviewTab: document.querySelector("#allReviewTab"),
  wrongReviewTab: document.querySelector("#wrongReviewTab"),
  resultDetail: document.querySelector("#resultDetail"),
  reviewButton: document.querySelector("#reviewButton"),
  retryButton: document.querySelector("#retryButton"),
  reviewList: document.querySelector("#reviewList")
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

function loadQuestions(questions) {
  state.questions = questions;
  state.answers = Array.from({ length: questions.length }, () => null);
  state.currentIndex = 0;
  state.submitted = false;
  elements.uploadView.hidden = true;
  elements.resultView.hidden = true;
  elements.quizView.hidden = false;
  elements.submitButton.hidden = false;
  elements.resetButton.hidden = false;
  setActiveNav("quiz");
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
    loadQuestions(normalizeQuestions(data));
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

function submitQuiz() {
  const unanswered = state.answers.filter((answer) => answer === null).length;
  if (unanswered > 0) {
    const ok = window.confirm(`Bạn còn ${unanswered} câu chưa trả lời. Bạn vẫn muốn nộp bài?`);
    if (!ok) return;
  }

  const score = calculateScore();
  const percent = Math.round((score / state.questions.length) * 100);
  const incorrect = state.questions.length - score;
  state.submitted = true;
  elements.quizView.hidden = true;
  elements.uploadView.hidden = true;
  elements.resultView.hidden = false;
  elements.submitButton.hidden = true;
  elements.scorePercent.textContent = `${percent}%`;
  elements.scoreLabel.textContent = percent >= 80 ? "Excellent" : percent >= 50 ? "Good" : "Review";
  elements.scoreRing.style.setProperty("--score-angle", `${percent * 3.6}deg`);
  elements.correctText.textContent = `${String(score).padStart(2, "0")} / ${state.questions.length}`;
  elements.incorrectText.textContent = `${String(incorrect).padStart(2, "0")} / ${state.questions.length}`;
  elements.allReviewTab.textContent = `All (${state.questions.length})`;
  elements.wrongReviewTab.textContent = `Incorrect (${incorrect})`;
  elements.resultDetail.textContent = `Bạn trả lời đúng ${score} trên tổng số ${state.questions.length} câu. Xem lại từng câu để nắm chắc phần còn yếu.`;
  setActiveNav("result");
  renderReview();
}

function renderReview() {
  elements.reviewList.innerHTML = "";
  state.questions.forEach((question, index) => {
    const isCorrect = state.answers[index] === question.answer;
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
  state.questions = [];
  state.answers = [];
  state.currentIndex = 0;
  state.submitted = false;
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
  if (!state.submitted) return;
  elements.uploadView.hidden = true;
  elements.quizView.hidden = true;
  elements.resultView.hidden = false;
  elements.submitButton.hidden = true;
  setActiveNav("result");
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
elements.reviewButton.addEventListener("click", renderReview);

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
