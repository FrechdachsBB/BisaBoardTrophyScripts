// ==UserScript==
// @name         TrophyTrade V2
// @namespace    http://tampermonkey.net/
// @version      2.1.1
// @description  Skript zum Vertauschen von Medaillen
// @author       Frechdachs
// @match        https://community.bisafans.de/acp/index.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bisafans.de
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

// CLASS DEFINITIONS---------------------------------------

class TradersStateDisplay {

    container = document.createElement("div");
    section = document.createElement("section");

    initialize() {
        let sister = this.getSisterElement();
        this.container.classList.add("traders-state-display");
        this.section.classList.add("section", "tradeDisplaySection");
        this.container.appendChild(this.section);
        sister.parentNode.insertBefore(this.container, sister);
        this.refresh();
    }

    getSisterElement() {
        return document.getElementsByClassName("paginationTop")[0];
    }

    static initialize(tradersState) {
        let result = new TradersStateDisplay(tradersState);
        tradersState.display = result;
        return result;
    }

    refresh() {
        let html;
        if (persistedState.traderA.oldTrophy.instanceId !== undefined) {
            html = `
                <h2 class="sectionTitle trade-section-title">Für Tausch ausgewählt</h2>
                <span class="trader-trophy-instance-id">${persistedState.traderA.oldTrophy.instanceId}</span>
                <span class="trader-trophy-name">${persistedState.traderA.oldTrophy.name}</span>
                <span class="trader-user-name">${persistedState.traderA.user.name}</span>
        `;
            this.container.classList.remove("hidden");
            this.section.innerHTML = html;

            let removeButton = document.createElement("span");
            removeButton.classList.add("icon", "icon16", "fa-times", "jsObjectAction", "pointer", "remove-trader-button");
            this.section.appendChild(removeButton);

            removeButton.addEventListener('click', () => {
                persistedState.traderA = structuredClone(DEFAULT_PERSISTED_STATE.traderA);
                persistState();
                sessionState.tradeBadge.classList.add("hidden");
                this.refresh();
            })

        } else {
            this.container.classList.add("hidden");
        }

    }

}

class TradePanel {
    _htmlObject = undefined;
    _userNameHtmlTag = undefined;
    _oldTrophyDescriptionHtmlTag = undefined;
    _oldTrophyImgHtmlTag = undefined;
    _oldTrophyNameHtmlTag = undefined;

    _newDescription = undefined;
    _newTrophyImgHtmlTag = undefined;
    _newTrophyInput = undefined;
    _newTrophyDatalist = undefined;
    _newTrophyHtmlUsedCheckbox = undefined;

    _newTrophyTextBox

    _traderFn = () => structuredClone(DEFAULT_PERSISTED_STATE.traderA);
    _tradePartnerFn = () => structuredClone(DEFAULT_PERSISTED_STATE.traderB);

    constructor(traderFn, tradePartnerFn) {
        this._userNameHtmlTag = document.createElement("span");
        this._oldTrophyDescriptionHtmlTag = document.createElement("span");
        this._oldTrophyImgHtmlTag = document.createElement("img");
        this._oldTrophyNameHtmlTag = document.createElement("span");
        this._userNameHtmlTag.classList.add("trade-partner-name");
        this._oldTrophyDescriptionHtmlTag.classList.add("trophy-description", "old");
        this._oldTrophyImgHtmlTag.classList.add("trophy-img", "old");
        this._oldTrophyNameHtmlTag.classList.add("trophy-name", "old")

        this._newDescription = document.createElement("textarea");
        this._newDescription.classList.add("trophy-description", "new");
        this._newTrophyImgHtmlTag = document.createElement("img");
        this._newTrophyImgHtmlTag.classList.add("trophy-img", "new");
        this._newTrophyHtmlUsedCheckbox = document.createElement("input");
        this._newTrophyHtmlUsedCheckbox.type = "checkbox";
        this._newTrophyHtmlUsedCheckbox.id = "useHtml-" + Math.floor(Math.random() * 10e15);
        this._newTrophyHtmlUsedCheckbox.classList.add("use-html-input");
        this.addHtmlUsedChangeListener();
        this.addDescriptionChangeListener();

        const inputAndDatalist = this._createTrophySelectInputBox(e => this.tradeTrophyChanged(e));
        this._newTrophyInput = inputAndDatalist.input;
        this._newTrophyDatalist = inputAndDatalist.datalist;
        this.traderFn = traderFn;
        this._tradePartnerFn = tradePartnerFn;
    }

    set traderFn(traderFn) {
        this._traderFn = traderFn;
        this._userNameHtmlTag.innerText = traderFn().user.name;
        this._oldTrophyDescriptionHtmlTag.innerText = traderFn().oldTrophy.description;
        this._oldTrophyNameHtmlTag.innerText = traderFn().oldTrophy.name;
        this._oldTrophyImgHtmlTag.src = getTrophyImageURL(traderFn().oldTrophy.baseId);
    }

    tradeTrophyChanged(trophy) {
        this._traderFn().newTrophy = { ...structuredClone(this._traderFn().newTrophy), ...structuredClone(trophy) };
        this._newTrophyImgHtmlTag.src = "https://community.bisafans.de/images/trophy/trophyImage-" + this._traderFn().newTrophy.baseId + ".png";
        console.log(this._tradePartnerFn());
        let generatedDescription = generateNewDescription(
            this._traderFn().oldTrophy.description,
            this._traderFn().oldTrophy.name,
            this._traderFn().newTrophy.name,
            this._tradePartnerFn().oldTrophy.description
        );
        this._newDescription.value = generatedDescription;
        this._newTrophyHtmlUsedCheckbox.checked = this._traderFn().newTrophy.htmlUsed;
        this._traderFn().newTrophy.description = generatedDescription;
        persistState();
    }

    addHtmlUsedChangeListener() {
        this._newTrophyHtmlUsedCheckbox.addEventListener('change', e => {
            this._traderFn().newTrophy.htmlUsed = this._newTrophyHtmlUsedCheckbox.checked;
            persistState();
        })
    }

    addDescriptionChangeListener() {
        this._newDescription.addEventListener("input", e => {
            this._traderFn().newTrophy.description = this._newDescription.value;
            persistState();
        })
    }

    /** callback: function({id, name, category})  
     *             Wird bei Event "input" aufgerufen, wenn eine gültige Medaille ausgewählt wurde
     *  
     *  returns: {input: HTMLInputElement, datalist: HTMLDatalistElement}
     * */
    _createTrophySelectInputBox(callback) {
        const input = document.createElement("input");
        const datalist = document.createElement("datalist");
        const datalistId = Math.floor(Math.random() * 10e15);
        datalist.id = datalistId;


        for (const element of sessionState.allTrophies) {
            const option = document.createElement("option");
            option.value = element.baseId;
            option.innerHTML = element.name;
            datalist.appendChild(option);
        }

        input.id = "tropyhInput" + datalistId;
        input.setAttribute("list", datalistId);
        input.type = "search";
        input.autocomplete = "off";
        input.classList.add("trade-trophy-input");

        input.addEventListener('input', event => {
            if (IsNumeric(input.value)) {
                const trophy = sessionState.allTrophies.find(element => element.baseId == input.value);
                if (trophy) {
                    input.value = trophy.name;
                    callback(trophy);
                }
            } else {
                const trophy = sessionState.allTrophies.find(element => element.name == input.value);
                if (trophy) {
                    callback(trophy);
                }
            }

        })

        return { input: input, datalist: datalist };
    }

    get htmlObject() {
        if (this._htmlObject == undefined) {
            this._htmlObject = document.createElement("div");
            this._htmlObject.classList.add("trade-panel")
            this._htmlObject.appendChild(this._userNameHtmlTag);

            const oldTrophyHtmlObject = document.createElement("div");
            oldTrophyHtmlObject.classList.add("trophy-descriptive-container", "old");


            const oldTrophyTitleHtmlObject = document.createElement("div");
            oldTrophyTitleHtmlObject.classList.add("trophy-descriptive-container-title")

            const oldTrophyCaption = document.createElement("span");
            oldTrophyCaption.innerText = "Gibt ab:"
            oldTrophyCaption.classList.add("trophy-descriptive-container-title-caption")
            oldTrophyHtmlObject.appendChild(oldTrophyCaption);
            oldTrophyTitleHtmlObject.appendChild(this._oldTrophyImgHtmlTag);
            oldTrophyTitleHtmlObject.appendChild(this._oldTrophyNameHtmlTag);
            oldTrophyHtmlObject.appendChild(oldTrophyTitleHtmlObject);
            oldTrophyHtmlObject.appendChild(this._oldTrophyDescriptionHtmlTag);

            this._htmlObject.appendChild(oldTrophyHtmlObject);


            const newTrophyHtmlObject = document.createElement("div");
            newTrophyHtmlObject.classList.add("trophy-descriptive-container", "new");

            const newTrophyTitleHtmlObject = document.createElement("div");
            newTrophyTitleHtmlObject.classList.add("trophy-descriptive-container-title")


            const newTrophyCaption = document.createElement("span");
            newTrophyCaption.innerText = "Erhält:"
            newTrophyCaption.classList.add("trophy-descriptive-container-title-caption")

            newTrophyTitleHtmlObject.appendChild(newTrophyCaption);
            newTrophyTitleHtmlObject.appendChild(this._newTrophyImgHtmlTag);
            newTrophyTitleHtmlObject.appendChild(this._newTrophyInput);
            newTrophyTitleHtmlObject.appendChild(this._newTrophyDatalist);
            newTrophyHtmlObject.appendChild(newTrophyTitleHtmlObject);
            newTrophyHtmlObject.appendChild(this._newDescription);

            const useHtmlContainer = document.createElement("div");

            const label = document.createElement("label");
            label.innerText = "HTML verwenden";
            label.classList.add("use-html-label");
            label.setAttribute("for", this._newTrophyHtmlUsedCheckbox.id);
            useHtmlContainer.appendChild(label);
            useHtmlContainer.appendChild(this._newTrophyHtmlUsedCheckbox);
            console.log("HTML USED: ", JSON.stringify(this._traderFn().newTrophy));
            this._newTrophyHtmlUsedCheckbox.checked = this._traderFn().newTrophy.htmlUsed;
            newTrophyHtmlObject.appendChild(useHtmlContainer);

            this._htmlObject.appendChild(newTrophyHtmlObject);
        }
        return this._htmlObject;
    }

}

//-------------------------------

const TRADE_APP_PATH = "user-trophy-trade"
const PERSISTED_STATE_VAR_NAME = "trophyTradeGlobalState";
const DEFAULT_PERSISTED_STATE = {
    traderA: {
        user: {
            id: undefined,
            name: undefined
        },
        oldTrophy: {
            name: undefined,
            instanceId: undefined,
            baseId: undefined,
            description: undefined,
            htmlUsed: false
        },
        newTrophy: {
            name: undefined,
            baseId: undefined,
            description: undefined,
            htmlUsed: false
        }
    },
    traderB: {
        user: {
            id: undefined,
            name: undefined
        },
        oldTrophy: {
            name: undefined,
            instanceId: undefined,
            baseId: undefined,
            description: undefined,
            htmlUsed: false
        },
        newTrophy: {
            name: undefined,
            baseId: undefined,
            description: undefined,
            htmlUsed: false
        }
    },
    userToken: undefined
};

let persistedState = structuredClone(DEFAULT_PERSISTED_STATE);

let sessionState = {
    tradeBadge: document.createElement("div"),
    display: new TradersStateDisplay(),
    allTrophies: undefined
}

const forumSectionMap = new Map();

function fillForumSectionMap() {
    forumSectionMap.set("Fanfiction", "dem Fanfiction-Bereich");
    forumSectionMap.set("Tauschbasar", "dem Tauschbasar");
    forumSectionMap.set("Mafia", "dem Mafia-Bereich");
    forumSectionMap.set("PnP", "dem PnP-Bereich");
    forumSectionMap.set("Chat", "dem Chat");
    forumSectionMap.set("Sammelkarten", "dem Sammelkarten-Bereich");
    forumSectionMap.set("Anime/Manga", "dem Anime und Manga-Bereich");
    forumSectionMap.set("Mafia", "dem Mafia-Bereich");
    forumSectionMap.set("Pokémon-Spin-Offs", "dem Pokémon-Spin-Offs-Bereich");
    forumSectionMap.set("Pokemon-Spin-Offs", "dem Pokémon-Spin-Offs-Bereich");
    forumSectionMap.set("RPG", "dem RPG-Bereich");
    forumSectionMap.set("Kunst und Handwerk", "dem Kunst und Handwerk-Bereich");
    forumSectionMap.set("Pokémon-Anime und -Manga", "dem Pokémon-Anime und -Manga-Bereich");
    forumSectionMap.set("Pokemon-Anime und -Manga", "dem Pokémon-Anime und -Manga-Bereich");
    forumSectionMap.set("Fanart", "dem Fanart-Bereich");
    forumSectionMap.set("Strategie und Kampf", "dem Strategie und Kampf-Bereich");
    forumSectionMap.set("Videospiele", "dem Videospiele-Bereich");
    forumSectionMap.set("GDP", "dem GDP-Bereich");
    forumSectionMap.set("Allgemeine Diskussionen", "den Allgemeinen Diskussionen");
    forumSectionMap.set("Pokémon Plauder- und Diskussionsecke", "der Pokémon Plauder- und Diskussionsecke");
    forumSectionMap.set("Pokemon Plauder- und Diskussionsecke", "der Pokémon Plauder- und Diskussionsecke");
    forumSectionMap.set("Bisatainment", "dem Bisatainment-Bereich");
    forumSectionMap.set("Wettbewerbe und Aktionen", "dem Wettbewerbe und Aktionen-Bereich");
    forumSectionMap.set("RPG&PnP", "dem RPG&PnP-Bereich");
    forumSectionMap.set("Pokémon-Editionen", "dem Pokémon-Editionen-Bereich");
}

function initializeGlobalState() {
    state = GM_getValue(PERSISTED_STATE_VAR_NAME);
    if (state) {
        persistedState = { ...structuredClone(persistedState), ...structuredClone(state) };
    }
    persistState();
}

function persistState() {
    GM_setValue(PERSISTED_STATE_VAR_NAME, persistedState);
    console.log("Persisted State: ", persistedState);
}

// -----------------------------------------------------------------------------------------------------------


function initializeTrophyListApp() {
    sessionState.tradeBadge.classList.add("trade-button-badge");
    addTradeButtons();
    addTrophyListCss();
    sessionState.display.initialize();
}

function addTradeButtons() {
    const rows = document.getElementsByClassName("userTrophyRow jsObjectActionObject");
    for (let r of rows) {
        let span = document.createElement("span");
        span.innerText = "⇄";
        span.title = "Medaille vertauschen";
        span.style.fontSize = "15pt";

        if (!r.childNodes[1].childNodes[1].getAttribute("class").includes("disabled")) {
            span.setAttribute("class", "activeTradeIcon");
            span.addEventListener("click", getTradeButtonEventListener(r, span));
        } else {
            span.setAttribute("class", "disabledTradeIcon");
            span.style.color = "#aaa";
        }
        r.getElementsByClassName("columnIcon")[0].appendChild(span);
    }
}

function getTradeButtonEventListener(node, buttonNode) {
    let userName = encodeURI(node.getElementsByClassName("columnUsername")[0].childNodes[0].innerText);
    let userId = node.getElementsByClassName("columnUsername")[0].childNodes[0].getAttribute("href").split("?user-edit/")[1].split("/")[0]
    let trophyName = node.getElementsByClassName("columnTrophy")[0].childNodes[0].nodeValue;
    let trophyInstanceId = node.getElementsByClassName("columnUserTrophyID")[0].innerText;

    if (persistedState.traderA.oldTrophy.instanceId !== undefined && trophyInstanceId == persistedState.traderA.oldTrophy.instanceId) {
        buttonNode.appendChild(sessionState.tradeBadge);
    }

    return () => {
        if (persistedState.traderA.oldTrophy.instanceId === undefined) {
            persistedState.traderA.user.userId = userId;
            persistedState.traderA.user.name = userName;
            persistedState.traderA.oldTrophy.name = trophyName;
            persistedState.traderA.oldTrophy.instanceId = trophyInstanceId;
            sessionState.tradeBadge.classList.remove("hidden");
            buttonNode.appendChild(sessionState.tradeBadge);
            persistState();
            sessionState.display.refresh();
        } else if (persistedState.traderA.oldTrophy.instanceId !== trophyInstanceId) {
            persistedState.traderB.user.userId = userId;
            persistedState.traderB.user.name = userName;
            persistedState.traderB.oldTrophy.name = trophyName;
            persistedState.traderB.oldTrophy.instanceId = trophyInstanceId;
            persistState();
            openTradeApp();
        } else {
            persistedState.traderA = structuredClone(DEFAULT_PERSISTED_STATE.traderA);
            sessionState.tradeBadge.classList.add("hidden");
            persistState();
            sessionState.display.refresh();
        }
        //openTradeApp(userId, userName, trophyInstanceId)
    };
}

function openTradeApp() {
    persistedState.userToken = document.querySelector('[name="t"]').value;
    persistState();
    window.location.href = "https://community.bisafans.de/acp/index.php?" + TRADE_APP_PATH;
}

function addTrophyListCss() {
    GM_addStyle(`
        .activeTradeIcon {
            position: relative;
        }
        
        .trade-button-badge {
            width: 10px;
            height: 10px;
            background: green;
            border-radius: 10px;
            position: absolute;
            top: 0;
            right: -10px;
            box-shadow: 0px 0px 10px green;
        }

        .trade-button-badge.hidden{
            display:none;
        }

        .trade-section-title{
            margin-top: 0;
        }

        .tradeDisplaySection{
            margin-top: 30px;
            border: 1px solid #ecf1f7;
            background-color: white;
            padding: 20px;
        }

        .tradeDisplaySection > span {
            margin-left: 10px;
        }

        .traders-state-display{
            max-height: 500px;
            overflow: hidden;
            transition: max-height 1s ease
        }

        .traders-state-display.hidden {
            max-height: 0;
            overflow: clip;
        }
   
        .activeTradeIcon:hover{ cursor: pointer; } 
        
        .disabledTradeIcon:hover{ cursor: default; }
        
        `)
}

//---------------------------------------------------------------------------------------

async function initializeTradeApp() {
    remove404ErrorMessage();
    if (persistedState.traderA.oldTrophy.instanceId == undefined) {
        alert("TraderA ist nicht gesetzt.")
        window.location.href = "https://community.bisafans.de/acp/index.php?user-trophy-list/";
    }
    else if (persistedState.traderB.oldTrophy.instanceId == undefined) {
        alert("TraderB ist nicht gesetzt.")
        window.location.href = "https://community.bisafans.de/acp/index.php?user-trophy-list/";

    }
    else if (persistedState.userToken == undefined) {
        alert("User Token wurde nicht gefunden. Bitte rufe diese Seite nur von der Übersichtsseite \"Vergebene Medaillen\" aus auf.");
        window.location.href = "https://community.bisafans.de/acp/index.php?user-trophy-list/";
    }


    persistedState.traderA.oldTrophy = await getTrophyDetailsFromInstanceId(persistedState.traderA.oldTrophy.instanceId);
    persistedState.traderB.oldTrophy = await getTrophyDetailsFromInstanceId(persistedState.traderB.oldTrophy.instanceId);
    persistState();

    await loadAllTrophies();
    sessionState.panelA = addPanel(() => persistedState.traderA, () => persistedState.traderB);
    sessionState.panelB = addPanel(() => persistedState.traderB, () => persistedState.traderA);

    prefillPanels();

    addNavigationButtons();

    addTradeAppCss();
}

function remove404ErrorMessage() {
    const err = document.getElementById("errorMessage");
    if (err == undefined) return;
    err.remove();
}

async function loadAllTrophies() {
    allTrophiesPromise = new Promise((resolve, failed) => {
        const request = new XMLHttpRequest();
        request.open("GET", "https://community.bisafans.de/acp/index.php?user-trophy-list/");
        request.onreadystatechange = () => {
            if (request.readyState == 4) {
                if (request.status == 200) {
                    response = new DOMParser().parseFromString(request.responseText, "text/html");
                    const trophyIdSelectBox = response.getElementById("trophyID");
                    const trophies = Array.from(trophyIdSelectBox.getElementsByTagName("option"))
                        .filter((element, index) => index !== 0)
                        .map(element => {
                            return {
                                baseId: element.value,
                                name: element.innerText,
                            }
                        })
                    resolve(trophies);
                } else {
                    alert("Medaillenliste konnte nicht geladen werden. Bitte starte den Vorgang erneut.");
                    window.location.href = "https://community.bisafans.de/acp/index.php?user-trophy-list/";
                }
            }
        }
        request.send(null);
    })
    sessionState.allTrophies = await allTrophiesPromise;
}


function addPanel(traderFn, tradePartnerFn) {
    const panel = new TradePanel(traderFn, tradePartnerFn);

    let container = document.getElementById("tradepanel-container");
    if (container == undefined) {
        container = document.createElement("div");
        container.id = "tradepanel-container";
        container.classList.add("tradepanel-container");
        document.getElementById("content").appendChild(container);
    }

    container.appendChild(panel.htmlObject)
    return panel;
}

function addNavigationButtons() {
    const container = document.createElement("div");
    container.classList.add("trade-navigation-container")


    const confirm = document.createElement("button");
    confirm.innerText = "Ausführen";
    confirm.classList.add("trade-confirm-button");

    confirm.addEventListener("click", async e => {
        if (!window.confirm("Sind Sie sicher, dass Sie den Tausch durchführen wollen?")) {
            return;
        }
        await executeTrade();
        container.remove();
    });
    container.appendChild(confirm);

    const abort = document.createElement("button");
    abort.innerText = "Abbrechen";
    abort.classList.add("trade-abort-button");
    abort.addEventListener("click", e => {
        if (!window.confirm("Alle Eingaben gehen verloren. Möchten Sie den Tausch wirklich abbrechen?")) {
            return;
        }
        persistedState = DEFAULT_PERSISTED_STATE;
        persistState();
        window.location.href = "https://community.bisafans.de/acp/index.php?user-trophy-list/";
    })
    container.appendChild(abort);


    document.getElementById("content").appendChild(container);
}

function getTrophyImageURL(trophyId) {
    return "https://community.bisafans.de/images/trophy/trophyImage-" + trophyId + ".png";
}

function generateNewDescription(oldText, oldTrophyName, newTrophyName, sourceTrophyDescription) {
    console.log(oldText, oldTrophyName, newTrophyName, sourceTrophyDescription);
    let parantheses = oldText.split("[");
    parantheses = parantheses[parantheses.length - 1];
    parantheses = "[" + parantheses;

    let sourceSection = sourceTrophyDescription.split("[");
    sourceSection = sourceSection[sourceSection.length - 1];
    sourceSection = sourceSection.split(",");
    sourceSection = sourceSection[sourceSection.length - 1].trim();
    sourceSection = sourceSection.substring(0, sourceSection.length - 1);
    sourceSection = forumSectionMap.get(sourceSection);

    oldTrophyName = oldTrophyName.split(" [")[0];

    return `${newTrophyName} aus ${sourceSection}. Ertauscht gegen ein ${oldTrophyName}, das TEXTEINFÜGEN ${parantheses}`;
}

async function getTrophyDetailsFromInstanceId(trophyInstanceId) {
    const promise = new Promise((resolve, reject) => {
        let trophy_detailPage = new XMLHttpRequest();
        trophy_detailPage.open("GET", "https://community.bisafans.de/acp/index.php?user-trophy-edit/" + trophyInstanceId + "/", true);
        trophy_detailPage.onreadystatechange = () => {
            if (trophy_detailPage.readyState == 4) {
                if (trophy_detailPage.status == 200) {
                    responseText = new DOMParser().parseFromString(trophy_detailPage.responseText, "text/html");

                    const trophyNameNode = responseText.getElementsByClassName("section")[0].children[1].children[1].children[0];
                    const trophyName = trophyNameNode.innerText;
                    const trophyURL = trophyNameNode.getAttribute('href');
                    const trophyBaseId = trophyURL.substring(56, trophyURL.length - 1);

                    const details = structuredClone(DEFAULT_PERSISTED_STATE.traderA.oldTrophy);
                    details.name = trophyName
                    details.baseId = trophyBaseId
                    details.instanceId = trophyInstanceId;
                    details.description = responseText.getElementById('description').value;
                    details.htmlUsed = responseText.querySelector('[name="trophyUseHtml"]').checked;
                    resolve(details);
                }
                else {
                    reject(`Fehler beim Laden der Medaillen-Details! Status: ${trophy_detailPage.status}`)
                }
            }
        }
        trophy_detailPage.send(null);
    });
    return promise;
}

function prefillPanels() {
    const newTrophyA = getShinyTrophy(persistedState.traderB.oldTrophy.name);
    if (newTrophyA != undefined) {
        console.log("Prefilling with ", persistedState.traderA);

        sessionState.panelA._newTrophyInput.value = newTrophyA.name;
        persistedState.traderA.newTrophy.htmlUsed = persistedState.traderA.oldTrophy.htmlUsed;
        sessionState.panelA.tradeTrophyChanged(newTrophyA);
        persistState();
    }

    const newTrophyB = getShinyTrophy(persistedState.traderA.oldTrophy.name);
    if (newTrophyB != undefined) {
        console.log("Prefilling with ", persistedState.traderB);

        sessionState.panelB._newTrophyInput.value = newTrophyB.name;
        persistedState.traderB.newTrophy.htmlUsed = persistedState.traderB.oldTrophy.htmlUsed;
        sessionState.panelB.tradeTrophyChanged(newTrophyB);
        persistState();
    }

}

function getShinyTrophy(regularTrophyName) {
    const searchTerm = "Schillerndes " + regularTrophyName.split(" [")[0];
    const allTrophies = sessionState.allTrophies;
    return allTrophies.find(el => el.name == searchTerm);
}


// Source - https://stackoverflow.com/a
// Posted by Ali Humayun, modified by community. See post 'Timeline' for change history
// Retrieved 2026-01-10, License - CC BY-SA 4.0
function IsNumeric(val) {
    return Number(parseFloat(val)) == val;
}

function addBackToTrophyListButton() {
    const button = document.createElement("button");
    button.innerText = "Zurück zur Medaillen-Liste";
    button.addEventListener("click", () => window.location.href = "https://community.bisafans.de/acp/index.php?user-trophy-list/");
    button.classList.add("back-to-list")
    document.getElementById("content").appendChild(button);
}


function addSuccessMessage(text) {
    addMessage(true, text);
}

function addErrorMessage(text) {
    addMessage(false, text);
}

function addMessage(success, text) {
    const content = document.getElementById("content");
    const node = document.createElement("p");
    node.classList.add(success ? "success" : "error");
    node.innerText = text;
    content.appendChild(node);
}


function addTradeAppCss() {
    GM_addStyle(`
        .trade-panel {
                display: flex;
                flex-direction: column;
                margin-bottom: 50px;
                
        }

        .trophy-img {
            height: 50px;
            width: 50px;
        }
        
        .trophy-descriptive-container {
            display: flex;
            flex-direction: column;
            max-width: 400px;
            
            padding: 5px;    
        }

        .trophy-descriptive-container.old{
            outline: 1px solid #e9e9e9;
            border-radius: 10px 10px 0 0;
            margin-bottom: 1px;
        }

        .trophy-descriptive-container.new{
            outline: 1px solid #e9e9e9;
            border-radius:0 0 10px 10px;
        }

        .trade-partner-name {
            font-size: 20px
        }

        .trophy-descriptive-container-title {
            display: flex;
            flex-direction: row;
            margin-bottom: 5px;  
        }

        .trophy-name {
            margin: auto 0 0 10px;
        }
        
        .trophy-descriptive-container-title-caption {
            font-size: 14px;
            font-weight: bold;
            margin: auto 10px auto 0;      
        }

        .trophy-description.old:hover {
            background-color: #f2f2f2;            
        }

        .trophy-description {
            padding: 10px;
        }

        .trophy-description.new {
            resize: vertical;
            height: 200px;
        }

        .trade-trophy-input {
            margin: auto 0 auto 10px !important;
        }

        .tradepanel-container {
            display: flex;
            flex-direction: row;
            gap: 10px;
        }

        .content{
            display: flex;
            flex-direction: column;
            gap: 10px;
        }

        .use-html-input{
            margin: 5px 0 auto 0;
        }

        .use-html-label{
            margin: auto 10px auto 0;
        }

        .trade-confirm-button {
            background-color: #2196f3;
            width: fit-content;
            color: white;
        }

        .trade-confirm-button:hover {
            background-color: #1a77c9 !important;
        }

        .back-to-list{
            background-color: #2196f3;
            width: fit-content;
            color: white;
        }

        .back-to-list:hover {
            background-color: #1a77c9 !important;
        }

        .trade-navigation-container {
            display: flex;
            flex-direction: row;
            gap: 10px;
        }

        .trade-abort-button {
            width: fit-content;
        }

    `);
}

async function executeTrade() {
    const userName1 = persistedState.traderA.user.name;
    const userName2 = persistedState.traderB.user.name;
    const trophyIdOld1 = persistedState.traderA.oldTrophy.instanceId;
    const trophyIdOld2 = persistedState.traderB.oldTrophy.instanceId;
    const trophyIdNew1 = persistedState.traderA.newTrophy.baseId;
    const trophyIdNew2 = persistedState.traderB.newTrophy.baseId;
    const descr1 = persistedState.traderA.newTrophy.description;
    const descr2 = persistedState.traderB.newTrophy.description;
    const allowHtml1 = persistedState.traderA.newTrophy.htmlUsed;
    const allowHtml2 = persistedState.traderB.newTrophy.htmlUsed;

    if (userName1 == undefined || userName1 == null) {
        addErrorMessage("Linker Tauschpartner ist nicht gesetzt.");
        throw "Linker Tauschpartner ist nicht gesetzt.";
    }
    if (userName2 == undefined || userName2 == null) {
        addErrorMessage("Rechter Tauschpartner ist nicht gesetzt.");
        throw "Rechter Tauschpartner ist nicht gesetzt.";
    }

    if (trophyIdOld1 == undefined || trophyIdOld1 == null) {
        addErrorMessage("Zu vertauschende Medaille des linken Tauschpartners fehlt.");
        throw "Zu vertauschende Medaille des linken Tauschpartners fehlt.";
    }

    if (trophyIdOld2 == undefined || trophyIdOld2 == null) {
        addErrorMessage("Zu vertauschende Medaille des rechten Tauschpartners fehlt.");
        throw "Zu vertauschende Medaille des rechten Tauschpartners fehlt.";
    }


    if (trophyIdNew1 == undefined || trophyIdNew1 == null) {
        addErrorMessage("Neue Medaille des linken Tauschpartners fehlt.");
        throw "Neue Medaille des linken Tauschpartners fehlt.";
    }
    if (trophyIdNew2 == undefined || trophyIdNew2 == null) {
        addErrorMessage("Neue Medaille des rechten Tauschpartners fehlt.");
        throw "Neue Medaille des rechten Tauschpartners fehlt.";
    }


    if (descr1 == undefined || descr1 == null || descr1.trim().length == 0) {
        addErrorMessage("Beschreibung für Medaille des linken Tauschpartners fehlt.");
        throw "Beschreibung für Medaille des linken Tauschpartners fehlt.";
    }

    if (descr2 == undefined || descr2 == null || descr2.trim().length == 0) {
        addErrorMessage("Beschreibung für Medaille des rechten Tauschpartners fehlt.");
        throw "Beschreibung für Medaille des rechten Tauschpartners fehlt.";
    }

    if (allowHtml1 == undefined || allowHtml1 == null) {
        addErrorMessage("Informationen zur Verwendung von HTML des linken Tauschpartners wurde nicht gefunden.");
        throw "Informationen zur Verwendung von HTML des linken Tauschpartners wurde nicht gefunden.";
    }

    if (allowHtml2 == undefined || allowHtml2 == null) {
        addErrorMessage("Informationen zur Verwendung von HTML des rechten Tauschpartners wurde nicht gefunden.");
        throw "Informationen zur Verwendung von HTML des rechten Tauschpartners wurde nicht gefunden.";
    }

    const html = (b) => b ? "&trophyUseHtml=1" : "";
    const token = persistedState.userToken;
    await fetch("https://community.bisafans.de/acp/index.php?user-trophy-add/", {
        "credentials": "include",
        "headers": {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "de,en-US;q=0.7,en;q=0.3",
            "Content-Type": "application/x-www-form-urlencoded",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-User": "?1"
        },
        "referrer": "https://community.bisafans.de/acp/index.php?user-trophy-add/",
        "body": "user=" + encodeURIComponent(userName1) + "&trophyID=" + trophyIdNew1 + "&useCustomDescription=1&description=" + encodeURIComponent(descr1) + html(allowHtml1) + "&t=" + encodeURIComponent(token),
        "method": "POST",
        "mode": "cors"
    }).then(response => {
        if (response.ok) {
            addSuccessMessage(`${userName1} hat die Medaille ${persistedState.traderA.newTrophy.name} erhalten.`)
        } else {
            addErrorMessage(`${userName1} konnte die Medaille nicht hinzugefügt werden. Statuscode: ${response.status}`)
        }
    }).catch(err => {
        addErrorMessage(`${userName1} konnte die Medaille nicht hinzugefügt werden. Fehler: ${err.message}`)
    });


    await fetch("https://community.bisafans.de/acp/index.php?user-trophy-add/", {
        "credentials": "include",
        "headers": {
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
            "Accept-Language": "de,en-US;q=0.7,en;q=0.3",
            "Content-Type": "application/x-www-form-urlencoded",
            "Upgrade-Insecure-Requests": "1",
            "Sec-Fetch-Dest": "document",
            "Sec-Fetch-Mode": "navigate",
            "Sec-Fetch-Site": "same-origin",
            "Sec-Fetch-User": "?1"
        },
        "referrer": "https://community.bisafans.de/acp/index.php?user-trophy-add/",
        "body": "user=" + encodeURIComponent(userName2) + "&trophyID=" + trophyIdNew2 + "&useCustomDescription=1&description=" + encodeURIComponent(descr2) + html(allowHtml2) + "&t=" + encodeURIComponent(token),
        "method": "POST",
        "mode": "cors"
    }).then(response => {
        if (response.ok) {
            addSuccessMessage(`${userName2} hat die Medaille ${persistedState.traderB.newTrophy.name} erhalten.`)
        } else {
            addErrorMessage(`${userName2} konnte die Medaille nicht hinzugefügt werden. Statuscode: ${response.status}`)
        }
    }).catch(err => {
        addErrorMessage(`${userName2} konnte die Medaille nicht hinzugefügt werden. Fehler: ${err.message}`)
    });


    await fetch("https://community.bisafans.de/acp/index.php?ajax-proxy/&t=" + encodeURIComponent(token), {
        "credentials": "include",
        "headers": {
            "Accept": "*/*",
            "Accept-Language": "de,en-US;q=0.7,en;q=0.3",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin"
        },
        "referrer": "https://community.bisafans.de/acp/index.php?user-trophy-list/",
        "body": "actionName=delete&className=wcf%5Cdata%5Cuser%5Ctrophy%5CUserTrophyAction&objectIDs%5B0%5D=" + trophyIdOld1 + "&",
        "method": "POST",
        "mode": "cors"
    }).then(response => {
        if (response.ok) {
            addSuccessMessage(`Medaille ${persistedState.traderA.oldTrophy.name} von ${userName1} wurde entfernt.`)
        } else {
            addErrorMessage(`Medaille ${persistedState.traderA.oldTrophy.name} von ${userName1} konnte nicht entfernt werden. Statuscode: ${response.status}`)
        }
    }).catch(err => {
        addErrorMessage(`Medaille ${persistedState.traderA.oldTrophy.name} von ${userName1} konnte nicht entfernt werden. Fehler: ${err.message}`)
    });


    await fetch("https://community.bisafans.de/acp/index.php?ajax-proxy/&t=" + encodeURIComponent(token), {
        "credentials": "include",
        "headers": {
            "Accept": "*/*",
            "Accept-Language": "de,en-US;q=0.7,en;q=0.3",
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
            "X-Requested-With": "XMLHttpRequest",
            "Sec-Fetch-Dest": "empty",
            "Sec-Fetch-Mode": "cors",
            "Sec-Fetch-Site": "same-origin"
        },
        "referrer": "https://community.bisafans.de/acp/index.php?user-trophy-list/",
        "body": "actionName=delete&className=wcf%5Cdata%5Cuser%5Ctrophy%5CUserTrophyAction&objectIDs%5B0%5D=" + trophyIdOld2 + "&",
        "method": "POST",
        "mode": "cors"
    }).then(response => {
        if (response.ok) {
            addSuccessMessage(`Medaille ${persistedState.traderB.oldTrophy.name} von ${userName2} wurde entfernt.`)
        } else {
            addErrorMessage(`Medaille ${persistedState.traderB.oldTrophy.name} von ${userName2} konnte nicht entfernt werden. Statuscode: ${response.status}`)
        }
    }).catch(err => {
        addErrorMessage(`Medaille ${persistedState.traderB.oldTrophy.name} von ${userName2} konnte nicht entfernt werden. Fehler: ${err.message}`)
    });

    persistedState = DEFAULT_PERSISTED_STATE;
    persistState();
    addBackToTrophyListButton();

}



(function () {
    fillForumSectionMap();
    initializeGlobalState();
    if (window.location.search.includes("user-trophy-list")) {
        initializeTrophyListApp();
    } else if (window.location.search.includes(TRADE_APP_PATH)) {
        initializeTradeApp();
    }
})();
