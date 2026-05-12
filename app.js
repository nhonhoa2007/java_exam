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
  errorMessage: document.querySelector("#errorMessage"),
  resetButton: document.querySelector("#resetButton"),
  loadSampleButton: document.querySelector("#loadSampleButton"),
  questionMap: document.querySelector("#questionMap"),
  progressText: document.querySelector("#progressText"),
  answeredText: document.querySelector("#answeredText"),
  questionNumber: document.querySelector("#questionNumber"),
  questionStatus: document.querySelector("#questionStatus"),
  questionText: document.querySelector("#questionText"),
  optionsList: document.querySelector("#optionsList"),
  prevButton: document.querySelector("#prevButton"),
  nextButton: document.querySelector("#nextButton"),
  submitButton: document.querySelector("#submitButton"),
  scoreText: document.querySelector("#scoreText"),
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
  elements.reviewList.hidden = true;
  elements.quizView.hidden = false;
  elements.resetButton.hidden = false;
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

function renderQuiz() {
  const question = state.questions[state.currentIndex];
  const answeredCount = state.answers.filter((answer) => answer !== null).length;

  elements.progressText.textContent = `Câu ${state.currentIndex + 1} / ${state.questions.length}`;
  elements.answeredText.textContent = `${answeredCount} đã trả lời`;
  elements.questionNumber.textContent = question.chapterTitle
    ? `${question.chapterTitle} · Câu ${state.currentIndex + 1}`
    : `Câu ${state.currentIndex + 1}`;
  elements.questionStatus.textContent = state.answers[state.currentIndex] === null ? "Chưa trả lời" : "Đã trả lời";
  elements.questionText.textContent = question.text;
  elements.questionText.classList.toggle("code-content", looksLikeCode(question.text));
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

    button.append(marker, optionText);
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
  state.submitted = true;
  elements.quizView.hidden = true;
  elements.resultView.hidden = false;
  elements.reviewList.hidden = true;
  elements.scoreText.textContent = `${score} / ${state.questions.length}`;
  elements.resultDetail.textContent = `Bạn trả lời đúng ${score} trên tổng số ${state.questions.length} câu.`;
}

function renderReview() {
  elements.reviewList.innerHTML = "";
  state.questions.forEach((question, index) => {
    const item = document.createElement("article");
    item.className = "review-item";

    const title = document.createElement("h3");
    title.textContent = `Câu ${index + 1}: ${question.text}`;
    item.append(title);

    question.options.forEach((option, optionIndex) => {
      const choice = document.createElement("p");
      choice.className = "review-choice";
      if (optionIndex === question.answer) choice.classList.add("correct");
      if (optionIndex === state.answers[index] && optionIndex !== question.answer) choice.classList.add("wrong");

      const prefix = String.fromCharCode(65 + optionIndex);
      const tags = [];
      if (optionIndex === question.answer) tags.push("đáp án đúng");
      if (optionIndex === state.answers[index]) tags.push("bạn chọn");
      choice.textContent = `${prefix}. ${option}${tags.length ? ` (${tags.join(", ")})` : ""}`;
      choice.classList.toggle("code-content", looksLikeCode(option));
      item.append(choice);
    });

    if (question.explanation) {
      const explanation = document.createElement("p");
      explanation.className = "review-choice";
      explanation.textContent = `Giải thích: ${question.explanation}`;
      item.append(explanation);
    }

    elements.reviewList.append(item);
  });
  elements.reviewList.hidden = !elements.reviewList.hidden;
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
  clearError();
}

function retryQuiz() {
  state.answers = Array.from({ length: state.questions.length }, () => null);
  state.currentIndex = 0;
  state.submitted = false;
  elements.resultView.hidden = true;
  elements.quizView.hidden = false;
  renderQuiz();
}

elements.fileInput.addEventListener("change", (event) => handleFile(event.target.files[0]));
elements.loadSampleButton.addEventListener("click", () => loadQuestions(normalizeQuestions(sampleQuestions)));
elements.resetButton.addEventListener("click", resetToUpload);
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
