// ==UserScript==
// @name         TrophyTrade V2
// @namespace    http://tampermonkey.net/
// @version      0.2
// @description  try to take over the world!
// @author       Frechdachs
// @match        https://community.bisafans.de/acp/index.php*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=bisafans.de
// @grant        GM_addStyle
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

let userId1;
let userName1;
let regularTrophyName1;
let regularTrophyInstanceId1;
let regularTrophyId1;
let forumSectionMap = new Map();

let deletTOnRead = false;
let resolvedT = undefined;

const tradeAppPath = "user-trophy-trade"
const searchParamUserId = "userId";
const searchParamTrophyInstanceId = "trophyInstanceId";
const searchParamUserName = "userName";


let tradeBadge = document.createElement("div");
let tradersState;
let tradersStateDisplay;

let allTrophiesPromise;

class Trader {
    userId = undefined;
    userName = undefined;
    trophyInstanceId = undefined;
    trophyBaseId = undefined;
    trophyName = undefined;
    trophyDescription = undefined;

    constructor(userId, userName, trophyInstanceId, trophyBaseId, trophyName, trophyDescription) {
        this.userId = userId;
        this.userName = userName;
        this.trophyInstanceId = trophyInstanceId;
        this.trophyBaseId = trophyBaseId;
        this.trophyName = trophyName;
        this.trophyDescription = trophyDescription;
    }

    get filled() {
        return this.userId !== undefined && this.trophyInstanceId !== undefined;
    }

}

class TradersState {
    _traderA = undefined;
    _traderB = undefined;


    set traderA(trader) {
        this._traderA = trader;
        this.syncState();
    }

    set traderB(trader) {
        this._traderB = trader;
        this.syncState();

    }

    get traderA() {
        return this._traderA;
    }


    get traderB() {
        return this._traderB;
    }

    syncState() {
        GM_setValue("tradersState", JSON.stringify(this));
        if (tradersStateDisplay !== undefined) tradersStateDisplay.refresh();
    }

    static initialize() {
        let storedValue = GM_getValue("tradersState");

        let result = new TradersState();
        if (storedValue != undefined) {
            storedValue = JSON.parse(storedValue);
            result.traderA = new Trader(
                storedValue._traderA.userId,
                storedValue._traderA.userName,
                storedValue._traderA.trophyInstanceId,
                storedValue._traderA.trophyBaseId,
                storedValue._traderA.trophyName,
                storedValue._traderA.trophyDescription
            );
            result.traderB = new Trader(
                storedValue._traderB.userId,
                storedValue._traderB.userName,
                storedValue._traderB.trophyInstanceId,
                storedValue._traderB.trophyBaseId,
                storedValue._traderB.trophyName,
                storedValue._traderB.trophyDescription
            );
        }
        result.syncState();
        return result;
    }
}

class TradersStateDisplay {

    container = document.createElement("div");
    section = document.createElement("section");

    constructor(tradersState) {
        let sister = this.getSisterElement();
        this.container.classList.add("traders-state-display");
        this.section.classList.add("section", "tradeDisplaySection");
        this.container.appendChild(this.section);
        sister.parentNode.insertBefore(this.container, sister);
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
                this.refresh();
                tradeBadge.classList.add("hidden");
            })

        } else {
            this.container.classList.add("hidden");
        }

    }

}

class userSearch {
    entries = [];
    maxPage;

    constructor(username, trophyId, page, callback) {
        let trophys = new XMLHttpRequest();
        trophys.open("GET", "https://community.bisafans.de/acp/index.php?user-trophy-list/&pageNo=" + page + "&trophyID=" + trophyId + "&username=" + username, true);
        trophys.send(null);
        trophys.onreadystatechange = () => {
            if (trophys.readyState == 4 && trophys.status == 200) {
                const parser = new DOMParser();
                const doc = parser.parseFromString(trophys.responseText, "text/html");
                for (let r of doc.getElementsByClassName("userTrophyRow jsObjectActionObject")) {
                    const trophyId = r.getElementsByClassName("columnID columnUserTrophyID")[0].innerText;
                    const userName = r.getElementsByClassName("columnText columnUsername")[0].innerText;
                    const userId = r.getElementsByClassName("columnText columnUsername")[0].childNodes[0].href.split("?user-edit/")[1].split("/")[0];
                    const trophyName = r.getElementsByClassName("columnTitle columnTrophy")[0].innerText;
                    this.entries.push({ trophyId: trophyId, userName: userName, trophyName: trophyName, userId: userId });
                }

                const pagination = doc.getElementsByClassName("pagination")[0];
                if (pagination != undefined) {
                    const li = pagination.getElementsByTagName("li");
                    this.maxPage = +li[li.length - 2].innerText.replace(".", "");
                } else this.maxPage = 1;
                callback(true);
            } else callback(false);
        }
    }

}
/*
class basicDialog {
    constructor(dialogTitle) {
        let dialogOverlay = document.createElement("div");
        dialogOverlay.setAttribute("class", "dialogOverlay");
        dialogOverlay.setAttribute("aria-hidden", "false");
        dialogOverlay.setAttribute("close-on-click", "true");
        dialogOverlay.addEventListener("click", () => dialogOverlay.remove());

        let dialogContainer = document.createElement("div");
        dialogOverlay.appendChild(dialogContainer);
        dialogContainer.setAttribute("class", "dialogContainer");
        dialogContainer.setAttribute("aria-hidden", "false");
        dialogContainer.setAttribute("role", "dialog");
        dialogContainer.addEventListener("click", e => e.stopPropagation());

        let dialogHeader = document.createElement("header");
        dialogContainer.appendChild(dialogHeader);

        let title = document.createElement("span");
        dialogHeader.appendChild(title);
        title.setAttribute("class", "dialogTitle");
        title.innerText = dialogTitle;

        let closeButton = document.createElement("a");
        dialogHeader.appendChild(closeButton);
        closeButton.setAttribute("class", "dialogCloseButton");
        closeButton.setAttribute("href", "#");
        closeButton.setAttribute("role", "button");
        closeButton.innerHtml = '<span className="icon icon24 fa-times"></span>'

        let dialogContent = document.createElement("div");
        dialogContainer.appendChild(dialogContent);
        dialogContent.setAttribute("class", "dialogContent dialogForm");
        dialogContent.setAttribute("style", "margin-bottom: 57px; max-height: 309px;");

        let formSubmit = document.createElement("div");
        dialogContent.appendChild(formSubmit);
        formSubmit.setAttribute("class", "formSubmit dialogFormSubmit");

        let submit = document.createElement("button");
        formSubmit.appendChild(submit);
        submit.setAttribute("class", "buttonPrimary");
        submit.setAttribute("data-type", "submit");
        submit.innerText = "OK";


        this.title = title;
        this.dialogContainer = dialogContainer;
        this.dialogContent = dialogContent;
        this.formSubmit = formSubmit;
        this.submit = submit;
        this.dialogOverlay = dialogOverlay;

    }

    show() {
        document.getElementById("content").appendChild(this.dialogOverlay);
    }

};

class tradeDialog extends basicDialog {
    oldTrophyId1;
    inputUserField1 = document.createElement("input");
    trophyImgOld1 = document.createElement("img");
    trophyName1Node = document.createElement("input");
    trophyImgNew1 = document.createElement("img");
    trophyDescrOld1 = document.createElement("textarea");
    inputTrophyDescrNew1 = document.createElement("textarea");
    allowHtml1 = document.createElement("input");

    inputUserField2 = document.createElement("input");
    trophyImgOld2 = document.createElement("img");
    inputTrophyName2 = document.createElement("input");
    trophyOldId = undefined;
    trophyImgNew2 = document.createElement("img");
    trophyNameNew2 = "";
    trophyDescrOld2 = document.createElement("textarea");
    inputTrophyDescrNew2 = document.createElement("textarea");
    searchTrophysButton = document.createElement("button");
    allowHtml2 = document.createElement("input");

    descriptionMap = new Map();

    listboxAvailableTrophys = document.createElement("select");

    messageBadge = document.createElement("p");

    constructor(userId, userName, trophyInstanceId) {
        super("Tausche Medaille " + trophyInstanceId + " von " + decodeURI(userName), () => {
        });

        let trophy_detailPage = new XMLHttpRequest();
        trophy_detailPage.open("GET", "https://community.bisafans.de/acp/index.php?user-trophy-edit/" + trophyInstanceId + "/", true);
        trophy_detailPage.onreadystatechange = () => {
            if (trophy_detailPage.readyState == 4 && trophy_detailPage.status == 200) {
                let parser = new DOMParser();
                const details = this.interpretTrophyDetailPage(parser.parseFromString(trophy_detailPage.responseText, "text/html"));

                this.evaluateTrophyTradeable(details.trophyObj.name);
                this.trophyName1Node.value = details.trophyObj.name;
                this.trophyImgOld1.setAttribute("src", details.imgSrc);
                this.trophyDescrOld1.value = details.descr;
                this.allowHtml1.checked = details.allowHtml;

            }
        }
        trophy_detailPage.send(null);
        this.userName = userName;
        this.setupContent();
        this.dialogContent.style.maxHeight = "500px";
        this.oldTrophyId1 = trophyInstanceId;
        this.submit.addEventListener('click', () => this.trade());
    }

    setupContent() {
        this.dialogContent.appendChild(this.messageBadge);


        this.dialogContent.appendChild(this.inputUserField1);
        this.inputUserField1.value = decodeURI(this.userName);
        this.inputUserField1.disabled = true;

        this.dialogContent.appendChild(this.trophyName1Node);
        this.trophyName1Node.disabled = true;

        this.dialogContent.appendChild(this.trophyImgOld1);
        this.trophyImgOld1.style.width = "50px";

        this.dialogContent.appendChild(this.trophyImgNew1);
        this.trophyImgNew1.style.width = "50px";

        const div1 = document.createElement("div");
        div1.appendChild(this.trophyDescrOld1);
        this.trophyDescrOld1.disabled = true;
        this.dialogContent.appendChild(div1);

        div1.appendChild(this.inputTrophyDescrNew1);
        this.inputTrophyDescrNew1.placeholder = "Neue Beschreibung";

        this.dialogContent.appendChild(this.allowHtml1);
        this.allowHtml1.type = "checkbox";
        this.allowHtml1.id = "allowHtmlUser1";
        const labelHtml1 = document.createElement("label");
        labelHtml1.innerText = "HTML in der Beschreibung verwenden";
        labelHtml1.setAttribute("for", "allowHtmlUser1");
        this.dialogContent.appendChild(labelHtml1);


        this.dialogContent.appendChild(document.createElement("hr"));
        this.inputTrophyName2 = this.selectField();
        this.dialogContent.appendChild(this.inputUserField2);
        this.dialogContent.appendChild(this.inputTrophyName2);
        this.dialogContent.appendChild(this.trophyImgOld2);
        this.trophyImgOld2.style.width = "50px";
        this.dialogContent.appendChild(this.searchTrophysButton);
        this.searchTrophysButton.disabled = this.trophyOldId == undefined;

        const div2 = document.createElement("div");
        this.dialogContent.appendChild(div2);
        div2.appendChild(this.listboxAvailableTrophys);

        this.searchTrophysButton.innerText = "Suche";
        this.searchTrophysButton.addEventListener("click", () => {
            const user = new userSearch(this.inputUserField2.value, this.trophyOldId, 1, (found) => {
                if (found) this.getListOfAvailableTradeTrophysAsNode(user.entries);
            });
        })
        this.addEventListenerToTradePartnerSelectBox();

        this.dialogContent.appendChild(this.trophyDescrOld2);
        this.trophyDescrOld2.disabled = true;

        this.dialogContent.appendChild(this.inputTrophyDescrNew2);

        this.dialogContent.appendChild(this.allowHtml2);
        this.allowHtml2.type = "checkbox";
        this.allowHtml2.id = "allowHtmlUser2";
        const labelHtml2 = document.createElement("label");
        labelHtml2.innerText = "HTML in der Beschreibung verwenden";
        labelHtml2.setAttribute("for", "allowHtmlUser2");
        this.dialogContent.appendChild(labelHtml2);


        //console.log(this.getShinyTrophy("Bisasam [Pflanze]"));


    }

    interpretTrophyDetailPage(responseText) {
        const trophyObj = this.findTrophyImageIdDetailPage(responseText);
        const name = trophyObj.name;
        const imgSrc = "https://community.bisafans.de/images/trophy/trophyImage-" + trophyObj.id + ".png";
        const descr = this.findTrophyDescription(responseText);
        const allowHtml = this.findHtml(responseText).checked;
        return { name: name, imgSrc: imgSrc, descr: descr, allowHtml: allowHtml, trophyObj: trophyObj }

    };

    findTrophyImageIdDetailPage(detailPage) {
        const trophyNameNode = detailPage.getElementsByClassName("section")[0].children[1].children[1].children[0];
        const trophyName = trophyNameNode.innerText;
        const trophyURL = trophyNameNode.getAttribute('href');
        const trophyImageID = trophyURL.substring(56, trophyURL.length - 1);
        return { id: trophyImageID, name: trophyName };
    }

    findTrophyDescription(detailPage) {
        return detailPage.getElementById('description').value;
    }

    findHtml(detailPage) {
        return detailPage.querySelector('[name="trophyUseHtml"]');
    }

    getShinyTrophy(regularTrophyName) {
        console.log(regularTrophyName.split(" [")[0]);
        const name = "Schillerndes " + regularTrophyName.split(" [")[0];

        const allShinyTrophys = Array.from(document.getElementById("trophyID").querySelector('[label="Schillernde Pokémon"]').childNodes).
            concat(Array.from(document.getElementById("trophyID").querySelector('[label="Schillernde Meilensteine"]').childNodes));
        console.log(allShinyTrophys);
        let id;
        let found = false;
        for (let n of allShinyTrophys) {

            if (n.innerText == name) {
                id = n.value;
                found = true;
                break;
            }
        }
        if (!found) return null;
        return { name: name, id: id };
    }

    selectField() {
        const select = document.createElement("input");
        select.setAttribute("class", "long");
        select.setAttribute("type", "search");
        select.setAttribute("list", "trophyList");
        select.setAttribute("placeholder", "Medaille");

        const trophyList = document.createElement("datalist");
        //trophyList.setAttribute("id","trophyListUser2");
        select.appendChild(trophyList);

        let elements = [...document.getElementById("trophyID").childNodes];
        console.log(elements);
        for (let i = 0; i < elements.length; i++) {
            if (elements[i].nodeType == 3) elements.splice(i, 1);
        }
        for (let n of elements) {
            trophyList.appendChild(n.cloneNode());
        }


        select.addEventListener('input', e => {
            const val = document.querySelector('#trophyList option[value="' + select.value + '"]');
            if (select.value == 0) {
                this.trophyImgOld2.removeAttribute("src");
                this.tropyImgNew1.removeAttribute("src");
                this.trophyOldId = undefined;
            } else if (!isNaN(select.value)) {
                this.trophyImgOld2.setAttribute("src", "https://community.bisafans.de/images/trophy/trophyImage-" + select.value + ".png");
                this.trophyOldId = select.value;
                if (this.getShinyTrophy(val.innerText) != null) {
                    this.hideMessageBadge();
                    this.trophyImgNew1.src = "https://community.bisafans.de/images/trophy/trophyImage-" + this.getShinyTrophy(val.innerText).id + ".png";

                } else {
                    this.unableToTrade("Schillernde Variante von " + val.innerText + " wurde nicht gefunden.");
                    this.trophyImgNew1.removeAttribute("src");
                }

            }
            this.searchTrophysButton.disabled = this.trophyOldId == undefined;

            if (val != null) select.value = val.innerText;
        });

        select.style.width = "250px";
        select.style.margin = "5px";

        return select;
    }

    unableToTrade(reason) {
        this.submit.disabled = true;
        this.messageBadge.innerText = reason;
        this.messageBadge.setAttribute("class", "error");
    }

    hideMessageBadge() {
        this.messageBadge.innerText = "";
        this.messageBadge.removeAttribute("class");
    }

    evaluateTrophyTradeable(trophyName) {
        if (this.getShinyTrophy(trophyName) != null) return;
        this.unableToTrade("Schillernde Variante von " + trophyName + " wurde nicht gefunden.");
        this.inputUserField1.disabled = true;
        this.trophyDescrOld1.disabled = true;
        this.inputTrophyDescrNew1.disabled = true;
        this.allowHtml1.disabled = true;
        this.inputUserField2.disabled = true;
        this.inputTrophyName2.disabled = true;
        this.inputTrophyDescrNew2.disabled = true;
        this.searchTrophysButton.disabled = true;
    }

    getListOfAvailableTradeTrophysAsNode(entries) {
        //console.log(entries);
        while (this.listboxAvailableTrophys.lastElementChild) {
            this.listboxAvailableTrophys.removeChild(this.listboxAvailableTrophys.lastElementChild);
        }

        for (let e of entries) {
            let trophy_detailPage = new XMLHttpRequest();
            this.descriptionMap = new Map();
            trophy_detailPage.open("GET", "https://community.bisafans.de/acp/index.php?user-trophy-edit/" + e.trophyId + "/", true);
            trophy_detailPage.onreadystatechange = () => {
                if (trophy_detailPage.readyState == 4 && trophy_detailPage.status == 200) {
                    let parser = new DOMParser();
                    const details = this.interpretTrophyDetailPage(parser.parseFromString(trophy_detailPage.responseText, "text/html"));
                    const option = document.createElement("option");
                    option.value = e.trophyId;
                    option.innerText = e.userName + ": [" + details.descr.split("[")[1];
                    this.listboxAvailableTrophys.appendChild(option);
                    this.descriptionMap.set(e.trophyId, {
                        userName: e.userName,
                        descr: details.descr,
                        allowHtml: details.allowHtml,
                        trophyName: details.name
                    });
                    this.selectedTradeTophy();
                }
            }
            trophy_detailPage.send(null);
        }

    }


    addEventListenerToTradePartnerSelectBox() {
        this.listboxAvailableTrophys.addEventListener('click', () => this.selectedTradeTophy());
    }

    selectedTradeTophy() {
        this.trophyDescrOld2.value = this.descriptionMap.get(this.listboxAvailableTrophys.value).descr;
        const descriptions = this.generateBasicDescriptions();
        this.inputTrophyDescrNew1.value = descriptions.descr1;
        this.inputTrophyDescrNew2.value = descriptions.descr2;
        this.allowHtml2.checked = this.descriptionMap.get(this.listboxAvailableTrophys.value).allowHtml;

    }

    generateBasicDescriptions() {
        const descrOld1 = this.trophyDescrOld1.value;
        const descrOld2 = this.trophyDescrOld2.value;

        const klammer1 = "[" + descrOld1.split("[")[1];
        const klammer2 = "[" + descrOld2.split("[")[1];



        const bereich1 = klammer1.includes(",") ? klammer1.split(", ")[1].split("]")[0] : klammer1.substring(1, klammer1.length - 1);
        const bereich2 = klammer2.includes(",") ? klammer2.split(", ")[1].split("]")[0] : klammer2.substring(1, klammer2.length - 1);

        let herkunft1 = forumSectionMap.get(bereich1);
        herkunft1 = herkunft1 == undefined ? bereich1 : herkunft1;

        let herkunft2 = forumSectionMap.get(bereich2);
        herkunft2 = herkunft2 == undefined ? bereich2 : herkunft2;
        //inputTrophyName2 trophyName1Node
        const newDescr1 = this.getShinyTrophy(this.descriptionMap.get(this.listboxAvailableTrophys.value).trophyName).name + " aus " + herkunft2 + ". Ertauscht gegen ein " + this.trophyName1Node.value.split(" [")[0] + " ... " + klammer1;
        const newDescr2 = this.getShinyTrophy(this.trophyName1Node.value).name + " aus " + herkunft1 + ". Ertauscht gegen ein " + this.descriptionMap.get(this.listboxAvailableTrophys.value).trophyName.split(" [")[0] + " ... " + klammer2;
        return { descr1: newDescr1, descr2: newDescr2 };
    }

    trade() {
        trade(this.inputUserField1.value,
            this.descriptionMap.get(this.listboxAvailableTrophys.value).userName,
            this.oldTrophyId1,
            this.listboxAvailableTrophys.value,
            this.getShinyTrophy(this.descriptionMap.get(this.listboxAvailableTrophys.value).trophyName).id,
            this.getShinyTrophy(this.trophyName1Node.value).id,
            this.inputTrophyDescrNew1.value,
            this.inputTrophyDescrNew2.value,
            this.allowHtml1,
            this.allowHtml2);
        this.dialogOverlay.click();
        //location.reload();
    }


}
*/


class TradePanel {
    _userName = undefined;
    _userId = undefined;
    _oldTrophyDetails = undefined;


    _htmlObject = undefined;
    _userNameHtmlTag = undefined;
    _oldTrophyDescriptionHtmlTag = undefined;
    _oldTrophyImgHtmlTag = undefined;
    _oldTrophyNameHtmlTag = undefined;

    _newDescription = undefined;
    _newTrophyImgHtmlTag = undefined;
    _newTrophyInput = undefined;
    _newTrophyDatalist = undefined;

    _newTrophyTextBox

    constructor(userName, userId, trophyDetails) {


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
        const inputAndDatalist = createTrophySelectInputBox(e => this.tradeTrophyChanged(e));
        this._newTrophyInput = inputAndDatalist.input;
        this._newTrophyDatalist = inputAndDatalist.datalist;

        this.userName = userName;
        this.userId = userId;
        this.trophyDetails = trophyDetails;
    }

    tradeTrophyChanged(trophy) {
        this._newTrophyImgHtmlTag.src = "https://community.bisafans.de/images/trophy/trophyImage-" + trophy.id + ".png";
        this._newDescription.value = generateNewDescription(this._oldTrophyDetails.trophyDescription, this._oldTrophyDetails.trophyName, trophy.name, tradersState.traderB.trophyDescription);
    }

    set userName(value) {
        this._userName = value;
        this._userNameHtmlTag.innerText = value;
    }

    set userId(value) {
        console.log("UserId set to ", value);
        this._userId = value;
    }

    set trophyDetails(value) {
        this._oldTrophyDetails = value;
        if (value !== undefined) {
            this._oldTrophyDescriptionHtmlTag.innerText = value.trophyDescription;
            this._oldTrophyImgHtmlTag.src = value.trophyImgSrc;
            this._oldTrophyNameHtmlTag.innerText = value.trophyName;
        }
    }

    get userName() {
        return this._userName;
    }

    get userId() {
        return this._userId;
    }

    get trophyDetails() {
        return this._oldTrophyDetails;
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



            this._htmlObject.appendChild(newTrophyHtmlObject);

        }
        return this._htmlObject;
    }

}

class TrophyDetail {
    trophyBaseId = undefined;
    trophyInstanceId = undefined;
    trophyName = undefined;
    trophyDescription = undefined;
    trophyImgSrc = undefined;
    htmlUsed = undefined;

    static fromTrophyDetailPage(responseText, instanceId) {
        const trophyObj = this._findTrophyImageIdDetailPage(responseText);

        const details = new TrophyDetail();
        details.trophyName = trophyObj.name;
        details.trophyBaseId = trophyObj.id;
        details.trophyInstanceId = instanceId;
        details.trophyDescription = this._findTrophyDescription(responseText);
        details.htmlUsed = this._findHtml(responseText).checked;
        details.trophyImgSrc = "https://community.bisafans.de/images/trophy/trophyImage-" + trophyObj.id + ".png";
        return details;
    };

    static _findTrophyImageIdDetailPage(detailPage) {
        const trophyNameNode = detailPage.getElementsByClassName("section")[0].children[1].children[1].children[0];
        const trophyName = trophyNameNode.innerText;
        const trophyURL = trophyNameNode.getAttribute('href');
        const trophyImageID = trophyURL.substring(56, trophyURL.length - 1);
        return { id: trophyImageID, name: trophyName };
    }

    static _findTrophyDescription(detailPage) {
        return detailPage.getElementById('description').value;
    }

    static _findHtml(detailPage) {
        return detailPage.querySelector('[name="trophyUseHtml"]');
    }
}




(function () {
    fillForumSectionMap();
    tradersState = TradersState.initialize();
    const subMenu = getSubmenu("MEDAILLEN");
    if (subMenu != undefined) {
        //addSubMenuEntry(subMenu, "Medaille vertauschen", window.location.search.includes(tradeAppPath), "https://community.bisafans.de/acp/index.php?" + tradeAppPath + "/");
    }

    if (window.location.search.includes("user-trophy-list")) {

        tradeBadge.classList.add("trade-button-badge");
        addTradeButtons();

        addTrophyListCss();
        tradersStateDisplay = TradersStateDisplay.initialize(tradersState);
        tradersStateDisplay.refresh();
    }

    if (window.location.search.includes("user-trophy-trade")) {
        initializeTradeApp();
    }
})();


function openDialog(userId, userName, trophyInstanceId) {
    let d = new tradeDialog(userId, userName, trophyInstanceId);
    d.show();
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

    var css = '.activeTradeIcon:hover{ cursor: pointer; } .disabledTradeIcon:hover{ cursor: default; }';
    var style = document.createElement('style');

    if (style.styleSheet) {
        style.styleSheet.cssText = css;
    } else {
        style.appendChild(document.createTextNode(css));
    }
    document.getElementsByTagName('head')[0].appendChild(style);
}

function getTradeButtonEventListener(node, buttonNode) {
    let userName = encodeURI(node.getElementsByClassName("columnUsername")[0].childNodes[0].innerText);
    let userId = node.getElementsByClassName("columnUsername")[0].childNodes[0].getAttribute("href").split("?user-edit/")[1].split("/")[0]
    let trophyName = node.getElementsByClassName("columnTrophy")[0].childNodes[0].nodeValue;
    let trophyInstanceId = node.getElementsByClassName("columnUserTrophyID")[0].innerText;

    if (tradersState.traderA !== undefined && trophyInstanceId == tradersState.traderA.trophyInstanceId) {
        buttonNode.appendChild(tradeBadge);
    }

    return () => {
        if (tradersState.traderA === undefined) {
            let trader = new Trader();
            trader.userId = userId;
            trader.userName = userName;
            trader.trophyName = trophyName;
            trader.trophyInstanceId = trophyInstanceId;
            tradersState.traderA = trader;
            tradeBadge.classList.remove("hidden");
            buttonNode.appendChild(tradeBadge);

        } else if (tradersState.traderA.trophyInstanceId !== trophyInstanceId) {
            let trader = new Trader();
            trader.userId = userId;
            trader.userName = userName;
            trader.trophyName = trophyName;
            trader.trophyInstanceId = trophyInstanceId;
            tradersState.traderB = trader;
            openTradeApp();
        } else {
            tradersState.traderA = undefined;
            tradeBadge.classList.add("hidden");

        }
        //openTradeApp(userId, userName, trophyInstanceId)
    };
}

function openTradeApp() {
    localStorage.setItem("t", document.querySelector('[name="t"]').value)
    window.location.href = "https://community.bisafans.de/acp/index.php?" + tradeAppPath;
}

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
}

function trade(userName1, userName2, trophyIdOld1, trophyIdOld2, trophyIdNew1, trophyIdNew2, descr1, descr2, allowHtml1, allowHtml2) {
    if (userName1 == undefined || userName1 == null ||
        userName2 == undefined || userName2 == null ||
        trophyIdOld1 == undefined || trophyIdOld1 == null ||
        trophyIdOld2 == undefined || trophyIdOld2 == null ||
        trophyIdNew1 == undefined || trophyIdNew1 == null ||
        trophyIdNew2 == undefined || trophyIdNew2 == null ||
        descr1 == undefined || descr1 == null ||
        descr2 == undefined || descr2 == null ||
        allowHtml1 == undefined || allowHtml1 == null ||
        allowHtml2 == undefined || allowHtml2 == null) return;

    const html = (b) => b ? "&trophyUseHtml=1" : "";
    const token = document.querySelector('[name="t"]').getAttribute("value");
    fetch("https://community.bisafans.de/acp/index.php?user-trophy-add/", {
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
    });
    fetch("https://community.bisafans.de/acp/index.php?user-trophy-add/", {
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
    });
    fetch("https://community.bisafans.de/acp/index.php?ajax-proxy/&t=" + encodeURIComponent(token), {
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
    });
    fetch("https://community.bisafans.de/acp/index.php?ajax-proxy/&t=" + encodeURIComponent(token), {
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
    });


}

function getSubmenu(categoryName) {
    const subMenuCategories = document.getElementsByClassName("acpPageSubMenuCategory");
    let found = false;
    for (const category of subMenuCategories) {
        const spanElements = category.getElementsByTagName("span");
        for (const spanElement of spanElements) {
            if (spanElement.innerText.toLowerCase() == categoryName.toLowerCase()) {
                return category.getElementsByTagName("ol")[0];
            }
        }
    }
    console.warn("SubMenü " + categoryName + " wurde nicht gefunden");
}

function addSubMenuEntry(target, name, active, href) {
    const li = document.createElement("li");
    const link = document.createElement("a");
    li.classList.add("acpPageSubMenuLinkWrapper")


    link.setAttribute("href", href);
    link.classList.add("acpPageSubMenuLink");
    link.innerText = name;
    if (active) {
        link.classList.add("active");
    }

    li.appendChild(link);
    target.appendChild(li);

}

function initializeTradeApp() {
    remove404ErrorMessage();
    createAllTrophiesPromise();
    tradersState = TradersState.initialize();
    addPanel(tradersState.traderA);
    addPanel(tradersState.traderB);
    addTradeAppCss();

    getT().then(t => {

    }).catch(rejected => {
        alert("User Token wurde nicht gefunden. Bitte rufe diese Seite nur von der Übersichtsseite \"Vergebene Medaillen\" aus auf.");
        window.location.href = "https://community.bisafans.de/acp/index.php?user-trophy-list/";
    })

}

function remove404ErrorMessage() {
    const err = document.getElementById("errorMessage");
    if (err == undefined) return;
    err.remove();
}


function createAllTrophiesPromise() {
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
                                id: element.value,
                                name: element.innerText,
                                category: element.parentNode.label
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
}

function addPanel(trader) {
    const userId = trader.userId;
    const userName = trader.userName;
    const trophyInstanceId = trader.trophyInstanceId;
    const upperPanel = new TradePanel(userName, userId);

    if (trophyInstanceId != undefined) {
        getTrophyDetailPagePromise(trophyInstanceId).then((details) => {
            upperPanel.trophyDetails = details;
            if (tradersState.traderA.trophyInstanceId == trophyInstanceId) {
                tradersState.traderA.trophyDescription = details.trophyDescription;

                console.log(tradersState);
            } else if (tradersState.traderB.trophyInstanceId == trophyInstanceId) {
                tradersState.traderB.trophyDescription = details.trophyDescription;
                console.log(tradersState);
            }
        })
    }

    document.getElementById("content").appendChild(upperPanel.htmlObject)
}

function getTrophyDetailPagePromise(trophyInstanceId) {
    return new Promise((resolve, reject) => {
        let trophy_detailPage = new XMLHttpRequest();
        trophy_detailPage.open("GET", "https://community.bisafans.de/acp/index.php?user-trophy-edit/" + trophyInstanceId + "/", true);
        trophy_detailPage.onreadystatechange = () => {
            if (trophy_detailPage.readyState == 4) {
                if (trophy_detailPage.status == 200) {
                    resolve(TrophyDetail.fromTrophyDetailPage(new DOMParser().parseFromString(trophy_detailPage.responseText, "text/html"), trophyInstanceId));
                }
                else {
                    reject(`Fehler beim Laden der Medaillen-Details! Status: ${trophy_detailPage.status}`)
                }
            }
        }
        trophy_detailPage.send(null);
    });
}

async function getShinyTrophy(regularTrophyName) {
    const searchTerm = "Schillerndes " + regularTrophyName.split(" [")[0];
    const allTrophies = await allTrophiesPromise;
    return allTrophies.find(el => el.name == searchTerm);
}

/** callback: function({id, name, category})  
 *             Wird bei Event "input" aufgerufen, wenn eine gültige Medaille ausgewählt wurde
 *  
 *  returns: {input: HTMLInputElement, datalist: HTMLDatalistElement}
 * */
function createTrophySelectInputBox(callback) {
    const input = document.createElement("input");
    const datalist = document.createElement("datalist");
    const datalistId = Math.floor(Math.random() * 10e15);
    datalist.id = datalistId;

    allTrophiesPromise.then(elements => {
        for (const element of elements) {
            const option = document.createElement("option");
            option.value = element.id;
            option.innerHTML = element.name;
            option.setAttribute("category", element.category);
            datalist.appendChild(option);
        }
    })

    input.id = "tropyhInput" + datalistId;
    input.setAttribute("list", datalistId);
    input.type = "search";
    input.autocomplete = "off";
    input.classList.add("trade-trophy-input");

    input.addEventListener('input', event => {
        allTrophiesPromise.then(elements => {
            if (IsNumeric(input.value)) {
                const trophy = elements.find(element => element.id == input.value);
                if (trophy) {
                    input.value = trophy.name;
                    callback(trophy);
                }
            } else {
                const trophy = elements.find(element => element.name == input.value);
                if (trophy) {
                    callback(trophy);
                }
            }
        })
    })

    return { input: input, datalist: datalist };
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

function getT() {
    return new Promise((resolve, reject) => {
        const t = localStorage.getItem("t");
        if (t == undefined) {
            reject("t nicht im localStorage gefunden");
            return;
        }
        if (deletTOnRead) {
            localStorage.removeItem("t");
        }
        resolvedT = t;
        resolve(t);
    })
}

// Source - https://stackoverflow.com/a
// Posted by Ali Humayun, modified by community. See post 'Timeline' for change history
// Retrieved 2026-01-10, License - CC BY-SA 4.0
function IsNumeric(val) {
    return Number(parseFloat(val)) == val;
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
   

        
        `)
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

        .content {
            display: flex;
            flex-direction: row;
            gap: 10px;
        }

    `);
}


