
  const accordionGroup = document.getElementById('accordionGroup');

  // Get all accordion triggers
  const accordionTriggers = accordionGroup.querySelectorAll('.accordion-trigger');

// Add click event listeners to accordion triggers
accordionTriggers.forEach(trigger => {
  trigger.addEventListener('click', e => {
    // Get the current accordion panel
    const currentAccordionPanel = e.currentTarget.nextElementSibling;

    // Close all accordion panels
    accordionGroup.querySelectorAll('.accordion-panel').forEach(panel => {
      panel.setAttribute('hidden', true);
    });

    // Open the current accordion panel
    currentAccordionPanel.removeAttribute('hidden');
  });
});




