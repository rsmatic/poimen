// Classic hero: faint copies of the instruments drifting behind the title
(function () {
  const hero = document.getElementById("hero");
  const floaters = document.createElement("div");
  floaters.className = "floaters";
  floaters.setAttribute("aria-hidden", "true");
  document.querySelectorAll(".instrument svg").forEach((svg, i) => {
    const f = document.createElement("div");
    f.className = "floater";
    f.style.setProperty("--i", i);
    f.appendChild(svg.cloneNode(true));
    floaters.appendChild(f);
  });
  hero.prepend(floaters);
})();
