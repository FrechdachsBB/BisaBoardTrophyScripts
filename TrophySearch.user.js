// ==UserScript==
// @name TrophySearchBB
// @version 0.1.2
// @namespace trophySearch_bisaboard.de
// @author Frechdachs
// @description Adds a input box to search for a trophy within the ACP
// @match https://community.bisafans.de/acp/index.php?user-trophy-add/
// @match https://community.bisafans.de/acp/index.php?user-trophy-list*
// @icon https://www.google.com/s2/favicons?sz=64&domain=bisafans.de
// ==/UserScript==



const originalTrophySelect = document.querySelector('#trophyID'),
    newTrophyInput = document.createElement('input'),
    trophyImage = document.createElement('img'),
    trophyList = document.createElement('datalist');


trophyList.setAttribute('id', 'trophyList');
trophyImage.setAttribute('width', '32');
trophyImage.setAttribute('height', '32');

for (var option of originalTrophySelect.options) { //add trophys to datalist for new input box
    var optionElement = document.createElement('option');
    optionElement.setAttribute('value', option.getAttribute('value'));
    optionElement.innerHTML = option.innerHTML;
    trophyList.appendChild(optionElement);
};


newTrophyInput.setAttribute('id', 'trophyInput');
newTrophyInput.setAttribute('list', 'trophyList');
newTrophyInput.setAttribute('type', 'search');
newTrophyInput.setAttribute('autocomplete', 'off');

setTrophyImageVisibility(false);

var dd = document.createElement('dd');
dd.appendChild(newTrophyInput);

originalTrophySelect.parentElement.appendChild(trophyImage);
originalTrophySelect.parentElement.parentElement.insertBefore(dd, originalTrophySelect.parentElement);
originalTrophySelect.parentElement.appendChild(trophyList);



newTrophyInput.addEventListener('input', function (e) {
    var input = e.target,
        list = input.getAttribute('list'),
        options = document.querySelectorAll('#' + list + ' option[value="' + input.value + '"]');


    if (options.length > 0) {
        trophyImage.setAttribute('src', getTrophyImageURLForId(input.value));
        setTrophyImageVisibility(true);
        originalTrophySelect.value = input.value;
        input.value = options[0].innerText;
    }


});

originalTrophySelect.addEventListener('change', function (e) {
    setTrophyImageVisibility(originalTrophySelect.value !== "0");
    trophyImage.setAttribute('src', getTrophyImageURLForId(originalTrophySelect.value))
});


// Helpfer Functions

function setTrophyImageVisibility(visible) {
    trophyImage.style.visibility = visible ? 'visible' : 'hidden';
}

function getTrophyImageURLForId(trophyId) {
    return "https://community.bisafans.de/images/trophy/trophyImage-" + trophyId + ".png";
}
