const KEY = "nanchang-itinerary-checks";

function load() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "[]");
  } catch {
    return [];
  }
}

function save(values) {
  localStorage.setItem(KEY, JSON.stringify(values));
}

const boxes = [...document.querySelectorAll("#checks input[type=checkbox]")];
const saved = load();
boxes.forEach((box, i) => {
  box.checked = Boolean(saved[i]);
  box.addEventListener("change", () => save(boxes.map((b) => b.checked)));
});
