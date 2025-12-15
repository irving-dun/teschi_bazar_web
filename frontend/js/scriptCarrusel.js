// Selecciona todos los elementos necesarios:
const slides = document.querySelectorAll(".slide-wrapper img");
const totalSlides = slides.length;
const prevBtn = document.getElementById("prevBtn");
const nextBtn = document.getElementById("nextBtn");
const sliderNavLinks = document.querySelectorAll(".slider-nav a");

// Variable global para rastrear qué slide estamos viendo.
// Lo inicializamos en 0 (el primer slide).
let currentSlideIndex = 0;

/**
 * Desplaza el carrusel al slide dado por el nuevo índice.
 * @param {number} newIndex - El índice (0, 1, 2...) del slide al que ir.
 */
function goToSlideByIndex(newIndex) {
  // 1. Asegurar el loop: Si se va más allá, regresa al inicio o al final.
  if (newIndex >= totalSlides) {
    newIndex = 0;
  } else if (newIndex < 0) {
    newIndex = totalSlides - 1;
  }

  // 2. ACTUALIZA EL ESTADO
  currentSlideIndex = newIndex;

  // 3. Obtiene el elemento de destino (la imagen) y realiza el scroll.
  // Usamos el ID del slide que se encuentra en el índice (ej: "slide-1")
  const targetElement = slides[currentSlideIndex];

  if (targetElement) {
    targetElement.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
    });
  }
}

//Botonees Next & Prev

// Logica: Llama a la función principal con el siguiente índice.
nextBtn.addEventListener("click", () => {
  goToSlideByIndex(currentSlideIndex + 1);
});

// Logica ANTERIOR: Llama a la función principal con el índice anterior.
prevBtn.addEventListener("click", () => {
  goToSlideByIndex(currentSlideIndex - 1);
});

//Flechas de navegacion del carrusel
sliderNavLinks.forEach((link, index) => {
  link.addEventListener("click", function (event) {
    event.preventDefault();

    // En lugar de buscar el elemento por ID, usamos el índice del enlace (0, 1, 2...)
    // que corresponde al índice del slide.
    goToSlideByIndex(index);
  });
});

// Inicializa el carrusel en el primer slide al cargar la página.
goToSlideByIndex(0);
