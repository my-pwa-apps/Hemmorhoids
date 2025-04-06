/**
 * Simplified splash screen for Hemorrhoids Game
 * Creates a static splash screen with the glowing text
 */

// Initialize when the window loads
window.addEventListener('load', function() {
    console.log("Splash screen initialized");
    
    // Ensure the title is centered
    const titleElement = document.querySelector('.splash-title');
    if (titleElement) {
        titleElement.style.textAlign = 'center';
        titleElement.style.width = '100%';
        titleElement.style.display = 'block';
        titleElement.style.position = 'relative';
        titleElement.style.margin = '0 auto';
    }
    
    // Add event listeners for the buttons
    document.getElementById('start-button').addEventListener('click', function() {
        if (typeof startGame === 'function') {
            startGame();
        }
    });
});