export const getAncestorZoom = (el) => {
  let zoom = 1;
  let curr = el;
  while (curr && curr !== document) {
    const z = window.getComputedStyle(curr).zoom;
    if (z && z !== "1" && z !== "normal") {
      zoom *= parseFloat(z);
    }
    curr = curr.parentNode;
  }
  return zoom;
};

export const getRootZoom = () => {
  const root = document.getElementById("root");
  if (!root) return 1;
  const zoom = window.getComputedStyle(root).zoom;
  if (zoom && zoom !== "1" && zoom !== "normal") {
    return parseFloat(zoom);
  }
  return 1;
};
