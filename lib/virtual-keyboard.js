// virtual-keyboard.js
(function() {
  // Build a bottom-docked container
  const kbContainer = document.createElement("div");
  kbContainer.id = "virtual-keyboard";
  kbContainer.style.position = "fixed";
  kbContainer.style.bottom = "0";
  kbContainer.style.left = "0";
  kbContainer.style.right = "0";
  kbContainer.style.background = "#222";
  kbContainer.style.padding = "6px";
  kbContainer.style.display = "grid";
  kbContainer.style.gridTemplateColumns = "repeat(10, 1fr)";
  kbContainer.style.gap = "4px";
  kbContainer.style.zIndex = "9999";

  const KEYS = [
    ..."QWERTYUIOP",
    ..."ASDFGHJKL",
    ..."ZXCVBNM",
    "←", // backspace
    "⏎"  // enter/next clue
  ];

  KEYS.forEach(key => {
    const btn = document.createElement("button");
    btn.textContent = key;
    btn.style.padding = "12px";
    btn.style.fontSize = "18px";
    btn.style.borderRadius = "6px";
    btn.style.border = "none";
    btn.style.background = "#444";
    btn.style.color = "#fff";
    btn.style.cursor = "pointer";
    btn.addEventListener("click", () => handleKeyPress(key));
    kbContainer.appendChild(btn);
  });

  document.body.appendChild(kbContainer);

  function handleKeyPress(key) {
    let event;

    if (key === "←") {
      event = new KeyboardEvent("keydown", { key: "Backspace" });
    } else if (key === "⏎") {
      event = new KeyboardEvent("keydown", { key: "Enter" });
    } else {
      event = new KeyboardEvent("keydown", { key });
    }

    document.dispatchEvent(event);
  }
})();
