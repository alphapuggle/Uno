
if('serviceWorker' in navigator) {
    navigator.serviceWorker
            .register('./sw.js')
            .then(function() { return false;});
}
$ = (selector) => {
    return document.querySelectorAll(selector).length > 1 ? document.querySelectorAll(selector) : document.querySelectorAll(selector)[0];
}
var cookie = {
    get: (cName) => {
        for(Cookie of document.cookie.split("; ")) {
            name = Cookie.split("=")[0]
            value = Cookie.split("=")[1]
            if(name == cName && value.length > 0) {
                return value
            }
        }
        return "";
    },
    set: (cName, value) => {
        document.cookie = `${cName}=${value}`
    },
    delete: (cName) => {
        document.cookie = `${cName}=`
    }
}
function isJSON(data) {
    try {
        return JSON.parse(data);
        return true;
    } catch (e) {
        return false;
    }
}
var disconnectCode = 0;
var links = [];
var selfUUID;
var lastPlayed = {face: "WILD", color: "WILD"}
class Player {
    constructor(name, hand, id = 0, self = false) {
        this.name = `${name}`;
        this.hand = hand;
        this.id = id;
        this.self = self
        if(this.self){
            this.lastHand = []
            this.element = document.createElement("div")
            this.element.className = "playerClass self"
            this.element.innerHTML = `<h2 class="username">${this.name}</h2><br>`
            this.handElement = document.createElement("div");
            this.handElement.classList.add("playerHand")
            this.unoIndicator = document.createElement("div")
            this.unoIndicator.classList = "playerClass unoCall hidden";
            this.unoIndicator.innerHTML = "Call Uno";
            cookie.set("lastName",this.name)
            cookie.set("lastUUID",this.id)
        } else {
            this.element = document.createElement("tr")
            this.element.classList.add("otherPlayerClass");
            this.element.innerHTML = `<td class="username">${this.name}</td>`
            this.handElement = document.createElement("td");
            this.unoIndicator = document.createElement("td")
            this.unoIndicator.classList = "unoCall hidden";
            this.unoIndicator.innerHTML = "Call Uno";
        }
        this.unoIndicator.setAttribute("onclick", `connection.send(JSON.stringify({event:'calluno', data:{id:'${this.id}'}}));`)
        this.element.appendChild(this.unoIndicator)
        this.element.appendChild(this.handElement)
        this.element.title = id
        this.add();
    }
    updateHand(newHand) {
        if(this.self && typeof(newHand) == "object") {
            for(var newCard of newHand) {
                var exists = false;
                var hasElement = false;
                for(var existingCard of this.hand) {
                    if(newCard.id == existingCard.id) {
                        exists = existingCard;
                        if(typeof(existingCard.element) == "object") {
                            hasElement = true;
                        }
                    }
                }
                if(!hasElement) {
                    !exists ? this.hand.push(newCard) : newCard = exists;
                    newCard.element = document.createElement("img");
                    newCard.element.alt = `${newCard.color}:${newCard.face}`
                    newCard.element.src = `./Cards/${newCard.color}_${newCard.face}.webp`;
                    newCard.element.className = "card";
                    newCard.element.setAttribute("onclick", `connection.send(JSON.stringify({event:'playcard', data:{id:'${newCard.id}'}}));`)
                    newCard.element.setAttribute("disabled",!(Player.checkPlayable(newCard) || !this.element.classList.contains("active")))
                    this.handElement.appendChild(newCard.element)
                    Player.animateCard(newCard.element, $("#deckCard"),1);
                }
            }
            for(var existingCard of this.hand) {
                var exists = false;
                for(var newCard of newHand) {
                    if(newCard.id == existingCard.id) {
                        exists = true;
                    }
                }
                if(!exists) {
                    Player.animateCard($("#lastCard"), existingCard.element,-1);
                    this.hand.splice(this.hand.indexOf(existingCard),1);
                    existingCard.element.remove()
                }
            }
            Player.updateSelfPlayable()
        } else if(!this.self && typeof(newHand) == "number") {
            this.handElement.innerHTML = `${newHand} ${newHand == 1 ? "card" : "cards"}`
        }
    }
    add() {
        this.updateHand(this.hand);
        Player.connected.push(this)
        if(this.self) {
            $("#SelfCards").appendChild(this.element)
        } else {
            $("#OtherPlayers").appendChild(this.element)
        }
        this.element.animate([{transform: "scale(0)"},{transform: "scale(1)"}],{duration:250, easing:"ease-in-out"})
    }
    remove() {
        this.element.animate([{transform: "scale(1)"},{transform: "scale(0)"}],{duration:250, easing:"ease-in-out"}).onfinish = () => {
            Player.connected.splice(Player.connected.indexOf(this), 1);
            this.element.parentElement.removeChild(this.element);
            Player.updateSelfPlayable();
            if(Player.connected.length == 0) {
                window.onload();
            }
        }
    }
}
Player.updateSelfPlayable = () => {
    for(var players of Player.connected) {
        if(players.self){
            var anyPlayable = false;
            for(var existingCard of players.hand) {
                existingCard.element.setAttribute("disabled",!(Player.checkPlayable(existingCard) && players.element.classList.contains("active") && Player.connected.length > 1))
                anyPlayable = Player.checkPlayable(existingCard) || anyPlayable;
            }
            if(players.element.classList.contains("active") && !anyPlayable && $("#wildSelector").style.display == "none" && connection.readyState == 1) {
                $("#deckCard").classList.add("deckHighlight")
            } else {
                $("#deckCard").classList.remove("deckHighlight")
            }
            return anyPlayable;
        }
    }
}
Player.checkPlayable = (card) => {
    return card.color == lastPlayed.color || card.face == lastPlayed.face || card.face.toString().includes("WILD")
}
//Player.animateCard = () => {return false;};
Player.animateCard = (playerCard, destinationCard, direction = 1) => {
    var startDimensions =  destinationCard.getBoundingClientRect()
    var endDimensions = playerCard.getBoundingClientRect()
    if(endDimensions.left != 0 && startDimensions.left != 0) {
        playerCard.style.visibility = "hidden"
        var animateCard = document.createElement("img");
        animateCard.classList.add("card");
        animateCard.setAttribute("disabled",playerCard.getAttribute("disabled"))
        animateCard.style.position = "absolute";
        document.body.appendChild(animateCard);
        animateCard.src = "./Cards/UNKNOWN.webp";
        animateCard.animate(
            [
                {
                    left: `${startDimensions.left}px`,
                    right: `${startDimensions.right}px`,
                    top: `${startDimensions.top}px`,
                    bottom: `${startDimensions.bottom}px`,
                    width: `${startDimensions.width}px`,
                    transform: "scale(1) scaleX(1) rotateY(0deg)",
                    content: `url("${destinationCard.src}")`
                }, 
                {
                    transform: "scale(1.2) scaleX(1) rotateY(0deg)",
                    content: `url("${destinationCard.src}")`
                },
                {
                    transform: direction == 1 ? "scale(1.2) scaleX(-1) rotateY(180deg)" : "scaleX(1) rotateY(0deg)",
                    content: `url("${direction == 1 ? playerCard.src : destinationCard.src}")`
                },
                {
                    left: `${endDimensions.left}px`,
                    right: `${endDimensions.right}px`,
                    top: `${endDimensions.top}px`,
                    bottom: `${endDimensions.bottom}px`,
                    width: `${endDimensions.width}px`,
                    transform: direction == 1 ? "scale(1) scaleX(-1) rotateY(180deg)" : "scaleX(1) rotateY(0deg)",
                    content: `url("${direction == 1 ? playerCard.src : destinationCard.src}")`
                }
            ], {duration: direction == 1 ? 500 : 300, easing:"ease-in-out"}
        ).onfinish = () => {
            animateCard.remove();
            playerCard.style.visibility = "visible"
        }
    }
}
Player.connected = []
function openConnection(url) {
    connection = new WebSocket(url);
    connection.onopen = () => {
        $("#inputValue").placeholder = "Username";
        $("#inputValue").maxLength = 16;
        $("#inputValue").value = cookie.get("lastName");
        $("#enterButton").innerHTML = `Login`;
        $("#enterButton").onclick = () => {
            cookie.set("lastName",$("#inputValue").value)
            connection.send(JSON.stringify({
                event: "createplayer",
                data: { name: $("#inputValue").value, lastUUID: cookie.get("lastUUID")}
            }))
        };
        disconnectCode == 1012 ? $("#enterButton").click() : null;
        connection.onmessage = (message) => {
            event = isJSON(message.data) && typeof(JSON.parse(message.data).event) == "string" ? JSON.parse(message.data).event.toLowerCase() : "nonjson";
            data = isJSON(message.data) ? JSON.parse(message.data).data : message.data;
            var actions = {
                player: () => {
                    $("#inputMenu").style.display = "none";
                    $("#exitMenu").style.display = "";
                    $("#OtherPlayers").parentElement.style.display = "";
                    selectedPlayer = false;
                    var count = 0;
                    for(players of Player.connected) {
                        if(players.id == data.id) {
                            selectedPlayer = players;
                            selectedPlayer.updateHand(data.hand);
                            count ++;
                        }
                    }
                    if(!selectedPlayer) {
                        selectedPlayer = new Player(data.name, data.hand, data.id, typeof(data.hand) == "object")
                    } else if (selectedPlayer.self && count < 2) {
                        selectedPlayer = new Player(data.name, data.hand, data.id, false)
                    }
                },
                removeplayer: () => {
                    for(players of Player.connected) {
                        if(players.id == data.id) {
                            selectedPlayer = players;
                        }
                    }
                    selectedPlayer.remove();
                },
                selectedplayer: () => {
                    for(players of Player.connected) {
                        players.element.classList.remove("active");
                        players.element.classList.remove("next");
                        if(players.id == data.id) {
                            players.element.classList.add("active");
                            if(players.self) {
                                navigator.vibrate([25, 12.5, 25])
                            }
                        } else if(players.id == data.nextId) {
                            players.element.classList.add("next");
                        }
                    }
                    Player.updateSelfPlayable();
                },
                lastplayed: () => {
                    $("#lastCard").animate(
                        [
                            {
                                transform: "scaleX(1) rotateY(0deg)",
                                content: `url("${$("#lastCard").src}")`
                            },
                            {
                                transform: "scaleX(-1) rotateY(180deg)",
                                content: `url("./Cards/${data.card.color}_${data.card.face}.webp")`
                            }
                        ], {duration:250, easing:"ease-in-out"}
                    )
                    lastPlayed.face = data.card.face;
                    lastPlayed.color = data.card.color;
                    $("#lastCard").src = `./Cards/${lastPlayed.color}_${lastPlayed.face}.webp`;
                    $("#lastCard").alt = `${data.card.color}_${data.card.face}`;
                    Player.updateSelfPlayable();
                },
                error: () => {
                    alert(data.message);
                },
                wildcolor: () => {
                    $("#wildSelector").style.display = "inherit";
                    Player.updateSelfPlayable();
                    for(var color of ["RED", "GREEN", "BLUE", "YELLOW"]) {
                        $(`#${color.toLowerCase()}Wild`).onclick = new Function(`connection.send(JSON.stringify({event: "wildcolor",data: {color: '${color}'}})),$("#wildSelector").style.display = "none";`);
                    }
                },
                win: () => {
                    for(var players of Player.connected) {
                        var selectedPlayer;
                        if(players.id == data.id) {
                            selectedPlayer = players;
                        }
                    }
                    alert(`${selectedPlayer.name} Wins!`)
                },
                skipplayer: () => {
                    for(var players of Player.connected) {
                        if(players.id == data.id){
                            players.element.animate(
                                [
                                    {backgroundColor: getComputedStyle(players.element).backgroundColor},
                                    {backgroundColor: "red"},
                                    {backgroundColor: getComputedStyle(players.element).backgroundColor}    
                                ],
                                { duration: 1000}
                            )
                        }
                    }
                },
                calluno: () => {
                    for(var players of Player.connected) {
                        if(data.id == players.id) {
                            if((players.self && Player.updateSelfPlayable()) || !players.self){
                                players.unoIndicator.classList.remove("hidden")
                            } else {
                                players.unoIndicator.classList.add("hidden")
                            }
                        } else {
                            players.unoIndicator.classList.add("hidden")
                        }
                    }
                },
                calleduno: () => {
                    for(var players of Player.connected) {
                        if(data.id == players.id) {
                            players.element.animate(
                                [
                                    {backgroundColor: getComputedStyle(players.element).backgroundColor},
                                    {backgroundColor: "#FFFF0088"},
                                    {backgroundColor: getComputedStyle(players.element).backgroundColor}    
                                ],
                                { duration: 2000, easing: "ease-in-out"}
                            )
                        }
                        if(data.on == players.id) {
                            players.element.animate(
                                [
                                    {backgroundColor: getComputedStyle(players.element).backgroundColor},
                                    {backgroundColor: "#ff0059"},
                                    {backgroundColor: getComputedStyle(players.element).backgroundColor}    
                                ],
                                { duration: 2000, easing: "ease-in-out"}
                            )
                        }
                    }
                },
                nonjson: () => {
                    console.log(data)
                }
            }
            try {
                typeof (actions[event]) != "undefined" ? actions[event]() : console.log("\x1b[31m\x1b[1m%s\x1b[0m", `\nERROR!\n Invalid action!\n`, {event: event, data: data});
            } catch(e) {
                console.log("\x1b[31m\x1b[1m%s\x1b[0m", "Message recieved cannot be parsed", e);
            }
        }
    }
    connection.onclose = (event) => {
        disconnectCode = event.code;
        if(disconnectCode == 1006) {
            document.body.animate(
                [
                    {backgroundColor: getComputedStyle(document.body).backgroundColor},
                    {backgroundColor: "red"},
                    {backgroundColor: getComputedStyle(document.body).backgroundColor}    
                ],
                { duration: 1000}
            )
        }
        $("#lastCard").animate(
            [
                {
                    transform: "scaleX(1) rotateY(0deg)",
                    content: `url("${$("#lastCard").src}")`
                },
                {
                    transform: "scaleX(-1) rotateY(180deg)",
                    content: `url("./Cards/BACK.webp")`
                }
            ], {duration:250, easing:"ease-in-out"}
        )
        $("#lastCard").src = `./Cards/BACK.webp`;
        $("#exitMenu").style.display = "none";
        $("#inputMenu").style.display = "";
        for(var players of Player.connected) {
            players.remove();
        }
        if(disconnectCode == 1012) {
            setTimeout(()=> {$("#enterButton").click();},500);
        }
        setTimeout(()=> {Player.updateSelfPlayable()},10);
        window.onload();
    }
} 
window.onload = () => {
    $("#inputValue").placeholder = "Url";
    $("#inputValue").maxLength = 9999999;
    $("#inputValue").value = `${window.location.host}:8600`;
    $("#inputValue").onkeydown = (event) => {
        if(event.key == "Enter") {
            $("#enterButton").click();
        }
    }
    $("#enterButton").innerHTML = `Connect`;
    $("#enterButton").onclick = () => {
        openConnection(`${window.location.protocol.includes("https") ? "wss://" : "ws://"}${$("#inputValue").value.replace(new RegExp("wss://","g"),"").replace(new RegExp("ws://","g"),"")}`)
        $("#enterButton").innerHTML = `Connect<i class="material-icons spin">loop</i>`;
    };
    $("#exitButton").onclick = () => {
        connection.close();
    };
    $("#inputValue").focus();
    $("#cardDeck").onclick = () => {
        connection.send(JSON.stringify(
            {
                event: "deck",
                data: null
            }
        ))
    }
    $("#themeSelector").onchange = () => {
        cookie.set("lastTheme", $("#themeSelector").value);
        if($("#themeSelector").value == "Light") {
            for(var elements of document.querySelectorAll("*")) { 
                elements.classList.add("light");
            }
        } else {
            for(var elements of document.querySelectorAll("*")) { 
                elements.classList.remove("light");
            }
        }
    }
    $("#themeSelector").value = cookie.get("lastTheme") == "" ? window.matchMedia("(prefers-color-scheme: dark)").matches ? "Dark" : "Light" : cookie.get("lastTheme")
    $("#themeSelector").onchange();
    $("#OtherPlayers").parentElement.style.display = "none";
}
