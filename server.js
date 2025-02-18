const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const os = require("os");
const { WSAEWOULDBLOCK } = require('constants');
const { v4: uuidv4} = require("uuid");
const port = 8600;
const SecureSocket = true;
var minimumPlayers = 3;
var wss;
var names = [];
var namesFile = fs.readFileSync('./names.txt').toString().replace(/\r?\n|\r/g, ',').split(",");
for(var index in namesFile) {
    if(index % 3 == 0) {
        names.push(namesFile[index])
    }
}
const colors = {
    "RED": "\x1b[31m\x1b[1m%s\x1b[0m",
    "GREEN": "\x1b[32m\x1b[1m%s\x1b[0m",
    "BLUE": "\x1b[34m\x1b[1m%s\x1b[0m",
    "YELLOW": "\x1b[33m\x1b[1m%s\x1b[0m",
    "WILD": "\x1b[35m\x1b[1m%s\x1b[0m",
    "CYAN": "\x1b[36m\x1b[1m%s\x1b[0m"
};

process.stdin.on("data", data => {
    try {
        let out = eval(data.toString())
        if(typeof(out) != "undefined") {
            console.log(out);
        }
    } catch (e) {
        console.log("\x1b[31m\x1b[1m%s\x1b[0m", `\nERROR`);
        console.log("\x1b[31m\x1b[1m%s\x1b[0m", e);
    }
})
const server = SecureSocket ? https.createServer({
    cert: fs.readFileSync('/etc/letsencrypt/live/alphapuggle.dev/cert.pem'), // Use your cert here to run with SSL
    key: fs.readFileSync('/etc/letsencrypt/live/alphapuggle.dev/privkey.pem') // Use your key here to run with SSL
}) : null;
wss = new WebSocket.Server(SecureSocket ? {server} : { port: 860 })
wss.broadcast = function (data, sender) {
    wss.clients.forEach(function (client) {
        if (client != (sender || null) && typeof(client.player) != "undefined") {
            client.send(data);
        }
    });
}
SecureSocket ? server.listen(860) : null;
const disconnectCodes = {
    1000: "Normal Closure",
    1001: "Going Away",
    1002: "Protocol Error",
    1003: "Unsupported Data",
    1005: "Unknown",
    1006: "Connection Lost",
    1009: "Message Too Big",
    1012: "Service Restart",
    1014: "Bad Gateway"
}
function isJSON(data) {
    try {
        return JSON.parse(data);
        return true;
    } catch (e) {
        return false;
    }
}
class Player {
    constructor(name) {
        this.name = name;
        this.hand = [];
        this.id = uuidv4();
        this.calledUno = false;
        var hasPlayableCard = false
        var numOfCards = 7
        for(var i = 1; i <= numOfCards; i ++) {
            if(i == numOfCards) {
                this.hand.push(hasPlayableCard ? Card.get.randomCard() : Card.get.playableCard());
            } else {
                var card = Card.get.randomCard()
                this.hand.push(card);
                hasPlayableCard = hasPlayableCard || Card.get.playableStatus(card)            
            }
        }
        console.log(colors["CYAN"],`${this.name} | ${this.id}: connected`)
        Player.connected.push(this);
        this.updateHand = () => {
            for(var ws of wss.clients) {
                if(this == ws.player) {
                    ws.send(JSON.stringify(
                        {
                            event: "player",
                            data: ws.player
                        }
                    ))
                    wss.broadcast(JSON.stringify(
                        {
                            event: "player",
                            data: {
                                name: ws.player.name,
                                hand: ws.player.hand.length,
                                id: ws.player.id
                            }
                        }
                    ))
                }
            }
        }
    }
}
Player.connected = [];
Player.disconnected = [];
Player.getPlayerById = (id) => {
    for(var players of Player.connected) {
        if(players.id == id) {
            return players
        }
    }
}
Player.getWsByPlayer = (player) => {
    for(var ws of wss.clients) {
        if(ws.player == player) {
            return ws;
        }
    }
}
Player.order = {
    currentPlayer: undefined,
    direction: 1,
    advance: (amount = 1) => {
        try{
            wss.broadcast(JSON.stringify(
                {
                    event: "calluno",
                    data: {id: "clear"}
                }
            ))
            if(typeof(Player.getWsByPlayer(Player.order.currentPlayer)) != "undefined") {
                if(Player.order.currentPlayer.hand.length < 2 && !Player.order.currentPlayer.calledUno) {
                    wss.broadcast(JSON.stringify(
                        {
                            event: "calluno",
                            data: {id: Player.order.currentPlayer.id}
                        }
                    ), Player.getWsByPlayer(Player.order.currentPlayer))
                } else if(Player.order.currentPlayer.hand.length >= 2) {
                    Player.order.currentPlayer.calledUno = false;
                }
            }
            for(var i = 0; i < amount; i++) {
                if(i > 0) {
                    wss.broadcast(JSON.stringify(
                        {
                            event: "skipplayer",
                            data: {
                                id: Player.order.currentPlayer.id
                            }
                        }
                    ))
                }
                Player.order.currentPlayer = Player.connected[Player.order.nextIndex()];
            }
            wss.broadcast(JSON.stringify(
                {
                    event: "selectedplayer",
                    data: {
                        id: Player.order.currentPlayer.id, 
                        nextId: Player.connected[Player.order.nextIndex()].id || undefined
                    }
                }
            ))
            if(Player.order.currentPlayer.hand.length == 2 && Player.connected.indexOf(Player.order.currentPlayer) != -1) {
                var hasPlayableCard = false;
                for(var card of Player.order.currentPlayer.hand) {
                    hasPlayableCard = Card.get.playableStatus(card) || hasPlayableCard;
                }
                if(hasPlayableCard) {
                    Player.getWsByPlayer(Player.order.currentPlayer).send(JSON.stringify(
                        {
                            event: "calluno",
                            data: {id: Player.order.currentPlayer.id}
                        }
                    ))
                }
            }
        } catch(e) {
            console.log(colors["RED"],"Error in player advance, likely missing ws",e)
        }
    },
    nextIndex: (amount = 1) => {
        return Player.order.validateIndex(Player.connected.indexOf(Player.order.currentPlayer) + (Player.order.direction * amount));
    },
    lastIndex: (amount = 1) => {
        return Player.order.validateIndex(Player.connected.indexOf(Player.order.currentPlayer) - (Player.order.direction * amount));
    },
    validateIndex: (index) => {
        if(Player.connected.length != 0) {
            while(index >= Player.connected.length) {
                index -= Player.connected.length;
            }
            while(index < 0) {
                index += Player.connected.length;
            }
        } else {
            return 0;
        }
        return index
    }
}
Player.cards = {
    giveCard: (player, amount = 1, advance = 0) => {
        var cardsToAdd = []
        for(var i = 0; i < amount; i++) {
            cardsToAdd.push(Card.get.randomCard(cardsToAdd))
        }
        Player.cards.addCardArray(player, cardsToAdd, advance)
    },
    givePlayableCard: (player, amount = 1, advance = 0) => {
        var cardsToAdd = []
        for(var i = 0; i < amount; i++) {
            cardsToAdd.push(Card.get.playableCard(cardsToAdd))
        }
        Player.cards.addCardArray(player, cardsToAdd, advance)
    },
    giveCardUntilPlayable: (player, advance = 0) => {
        var cardsToAdd = []
        do {
            var card = Card.get.randomCard(cardsToAdd)
            cardsToAdd.push(card)
        } while(!Card.get.playableStatus(card))
        Player.cards.addCardArray(player, cardsToAdd, advance)
    },
    addCardArray: (player, array, advance) => {
        Player.order.advance(advance);
        for (var i = 0; i < array.length; i++) {
            setTimeout(()=> {
                player.hand.push(array[0])
                array[0].taken = true;
                player.updateHand();
                array.splice(0,1);
                Player.order.advance(0);
            }, i * 500)
        }
    }
}
//This can probably be moved to another server if needed
class Bot {
    constructor() {
        Bot.bots.push(this)
        this.connection = new WebSocket(`${SecureSocket ? "wss://" : "ws://"}localhost:860`, {rejectUnauthorized: false});
        this.name = names[Math.floor(Math.random() * names.length)]
        this.callUnoOn = "clear"
        this.remove = () => {
            if(this.connection.readyState == 1) {
                this.connection.close(4002);
            }
            Bot.bots.splice(Bot.bots.indexOf(this),1)
            if(Bot.bots.length > 0 ) {
                if(Bot.clearing) {
                    Bot.bots[Bot.bots.length - 1].remove()
                }
            } else {
                Bot.clearing = false;
            }
        }
        this.connection.onopen = () => {
            this.connection.onmessage = (message) => {
                event = isJSON(message.data) && typeof(JSON.parse(message.data).event) == "string" ? JSON.parse(message.data).event.toLowerCase() : "nonjson";
                data = isJSON(message.data) ? JSON.parse(message.data).data : message.data;
                var actions = {
                    player: () => {
                        if(typeof(data.hand) == "object") {
                            this.id = data.id;
                            this.hand = data.hand
                        }
                        if(this.selectedplayer == this.id && this.calledDeck) {
                            setTimeout(() => {
                                this.playcard()
                            }, Math.floor(Math.random() * 2500) + 500);
                        }
                    },
                    selectedplayer: () => {
                        this.selectedplayer = data.id
                        if(this.selectedplayer == this.id) {
                            setTimeout(() => {
                                this.playcard()
                            }, Math.floor(Math.random() * 2500) + 500);
                        } else {
                            this.calledDeck = false;
                        }
                    },
                    wildcolor: () => {
                        setTimeout(()=> {
                            this.connection.send(JSON.stringify({event: "wildcolor", data: {color: ["RED", "GREEN", "BLUE", "YELLOW"][Math.floor(Math.random() * 4)]}}))
                        }, Math.floor(Math.random() * 1500) + 500)
                    },
                    calluno: () => {
                        this.callUnoOn = data.id;
                        if(data.id != "clear") {
                            Math.floor(Math.random() * 5000) < 4900 ? setTimeout(() => {
                                if(this.callUnoOn != "clear") {
                                    this.connection.send(JSON.stringify({event:'calluno', data:{id:`${this.callUnoOn}`}}))
                                }
                            }, Math.floor(Math.random() * 2000) + 1000) : null;
                        }
                    },
                    lastplayed: () => {
                        this.lastPlayed = data.card;
                    },
                    skipplayer: () => {return false;},
                    removeplayer: () => {return false;},
                    calleduno: () => {return false;},
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
            this.connection.send(JSON.stringify(
                {
                    event: "createPlayer",
                    data: {name: `${this.name} [Bot]`, lastUUID: null}
                }
            ))
        }
        this.playcard = () => {
            var playableCards = []
            for(var card of this.hand) {
                (card.color == this.lastPlayed.color || card.face == this.lastPlayed.face || card.face.toString().includes("WILD")) ? playableCards.push(card) : null;
            }
            if(playableCards.length == 0) {
                this.calledDeck = true;
                this.connection.send(JSON.stringify({event: "deck",data: null}))
            } else {
                this.connection.send(JSON.stringify({event:'playcard', data:{id:`${playableCards[Math.floor(Math.random() * playableCards.length)].id}`}}));
            }

        }
    }
}
Bot.clearing = false;
Bot.bots = []
Bot.update = () => {
    if(Player.connected.length == Bot.bots.length && Bot.bots.length != 0) {
        Bot.clearing = true;
        Bot.bots[Bot.bots.length - 1].remove()
    } else {
        if(Player.connected.length > 0) {
            if(Player.connected.length < minimumPlayers && !Bot.clearing) {
                new Bot()
            } else if (Player.connected.length > minimumPlayers && Bot.bots.length > 0) {
                Bot.bots[Bot.bots.length - 1].remove();
            }
        }
    }
    for(var bots of Bot.bots) { 
        if(bots.connection.readyState == 3) {
            bots.remove();
        } 
    }
}
class Card {
    constructor(face, color) {
        this.face = face;
        this.color = color;
        this.taken = false;
        this.id = uuidv4();
        Card.cards.push(this);
    }
}
Card.cards = [];
Card.get = {
    playableCard: (exclude = []) => {
        do {
            var card = Card.get.randomCard();
            if(!Card.get.playableStatus(card) || exclude.indexOf(card) != -1 || card.taken){
                card.taken = false
            }
        } while(!Card.get.playableStatus(card) || exclude.indexOf(card) != -1 || card.taken)
        card.taken = true;
        return card
    },
    randomCard: (exclude = []) => {
        Card.get.verifyCards();
        do {
            var card = Card.cards[Math.floor(Math.random() * Card.cards.length)];
        } while(card.taken || exclude.indexOf(card) != -1)
        card.taken = true;
        return card
    },
    playableStatus: (card) => {
        return lastPlayed.face == card.face || lastPlayed.color == card.color || card.color == "WILD"
    },
    verifyCards: () => {
        var available = 0;
        for(var card of Card.cards) {
            if(!card.taken) {
                available++;
            }   
        }
        if(available <= 10) {
            console.log(colors["RED"],`Deck dangerously low on cards! Only ${available} cards available`)
            addDeck();
        }
    }
}
function addDeck() {
    //each color
    var count = 0;
    for (color = 0; color < 4; color++) {
        //each number
        new Card(0, ["RED", "GREEN", "BLUE", "YELLOW"][color]);
        count ++
        for (number = 1; number < 10; number++) {
            new Card(number, ["RED", "GREEN", "BLUE", "YELLOW"][color]);
            new Card(number, ["RED", "GREEN", "BLUE", "YELLOW"][color]);
            count += 2
        }
        //special cards
        for (number = 0; number < 3; number++) {
            new Card(["REVERSE", "SKIP", "PLUS2"][number], ["RED", "GREEN", "BLUE", "YELLOW"][color]);
            new Card(["REVERSE", "SKIP", "PLUS2"][number], ["RED", "GREEN", "BLUE", "YELLOW"][color]);
            count += 2
        }
    }
    //wild & +4 wild
    for (number = 0; number < 4; number++) {
        new Card("PLUS4WILD", "WILD");
        new Card("WILD", "WILD");
        count += 2
    }
    console.log(colors["GREEN"],`Added ${count} cards to the deck. ${Card.cards.length} total.`)
}
var lastPlayed;
function setupServer() {
    Card.cards = [];
    addDeck();
    lastPlayed = Card.get.randomCard();
    lastPlayed.color.includes("WILD") ? lastPlayed.color = ["RED", "GREEN", "BLUE", "YELLOW"][Math.round(Math.random() * 3)]: null;
    console.log(colors[lastPlayed.color], `First Card: ${lastPlayed.color}-${lastPlayed.face}`);
}
setupServer()

wss.on("connection", (ws, req) => {
    ws.selectingColor = false;
    ws.deck = false;
    ws.on("message", message => {
        event = isJSON(message) && typeof(JSON.parse(message).event) == "string" ? JSON.parse(message).event.toLowerCase() : "nonjson";
        data = isJSON(message) ? JSON.parse(message).data : message;
        var actions = {
            createplayer: () => {
                var duplicate = false;
                var incomingName = data.name.replace(/[^a-z,0-9,\s,\!,\@,\#,\$,\%,\^,\&,\*,\(,\),\|,\,,\.,\/,\~,\`,\",\?,\-,\[,\]]/gi,"").slice(0,16)
                for(var players of Player.connected) {
                    if(players.name == incomingName) {
                        duplicate = true;
                    }
                }
                if(typeof(ws.player) == "undefined" && incomingName.length > 0 && !duplicate) {
                    var existingPlayer = false;
                    if(data.lastUUID != "undefined") {
                        for(var disconnectedPlayers of Player.disconnected) {
                            if (disconnectedPlayers.id == data.lastUUID) {
                                ws.player = disconnectedPlayers;
                                Player.connected.push(ws.player)
                                ws.player.name = incomingName;
                                console.log(colors["CYAN"],`${ws.player.name} | ${ws.player.id}: reconnected`);
                                existingPlayer = true;
                                Player.disconnected.splice(Player.disconnected.indexOf(ws.player),1)
                            }
                        }
                    }
                    existingPlayer ? null : ws.player = new Player(incomingName);
                    if(typeof(Player.order.currentPlayer) == "undefined") {
                        Player.order.currentPlayer = ws.player;
                    }
                    ws.send(JSON.stringify(
                        {
                            event: "lastplayed",
                            data: {
                                card: lastPlayed
                            }
                        }
                    ))
                    for(players of Player.connected) {
                        ws.send(JSON.stringify(
                            {
                                event: "player",
                                data: {
                                    name: players.name,
                                    hand: players == ws.player ? players.hand : players.hand.length,
                                    id: players.id
                                }
                            }
                        ))
                    }
                    ws.player.updateHand();
                    Player.order.advance(0)
                } else if(incomingName.length <= 0) {
                    ws.send(JSON.stringify(
                        {
                            event: "error",
                            data: {message:"Please Enter a Username"}
                        }
                    ))
                } else if(duplicate) {
                    ws.send(JSON.stringify(
                        {
                            event: "error",
                            data: {message:"Username already in use"}
                        }
                    ))
                }
                setTimeout(()=>{Bot.update();},500);
            },
            playcard: () => {
                if(Player.order.currentPlayer == ws.player) {
                    for(var card of ws.player.hand) {
                        if(Player.connected.length > 1 && !ws.selectingColor && data.id == card.id && (card.face == lastPlayed.face || card.color == lastPlayed.color || card.color.includes("WILD"))) {
                            ws.deck = false;
                            console.log(colors[card.color],`Card (${card.color}_${card.face}:${card.id}) played by (${ws.player.name}:${ws.player.id})`)
                            lastPlayed.taken = false;
                            lastPlayed.face.toString().includes("WILD") ? lastPlayed.color = "WILD" : null;
                            lastPlayed = card;
                            ws.player.hand.splice(ws.player.hand.indexOf(card),1)
                            ws.player.updateHand();
                            wss.broadcast(JSON.stringify(
                                {
                                    event: "lastplayed",
                                    data: {
                                        card: lastPlayed
                                    }
                                }
                            ))
                            //TODO: Add scenarios for special cards
                            var cardFunctions = {
                                NUMBER: () => {
                                    Player.order.advance();
                                },
                                WILD: () => {
                                    ws.selectingColor = true;
                                    ws.send(JSON.stringify(
                                        {
                                            event: "wildcolor",
                                            data: {face: card.face}
                                        }
                                    ))
                                },
                                PLUS2: () => {
                                    Player.cards.giveCard(Player.connected[Player.order.nextIndex()],2,2);
                                },
                                SKIP: () => {
                                    Player.order.advance(2);
                                },
                                REVERSE: () => {
                                    Player.order.direction *= -1;
                                    Player.order.advance(Player.connected.length <= 2 ? 2 : 1)
                                }
                            }
                            var action = !isNaN(parseInt(card.face)) ? "NUMBER" : card.face.toString().includes("WILD") ? "WILD" : card.face;  
                            cardFunctions[action]();
                            if(ws.player.hand.length <= 0) {
                                wss.broadcast(JSON.stringify(
                                    {
                                        event: "win",
                                        data: {id: ws.player.id}
                                    }
                                ))
                                console.log(colors["GREEN"],`${ws.player.name || "Somebody"} won, resetting server`);
                                setTimeout(()=> {
                                    restart()
                                }, 2000)
                            }
                        }
                    }
                }
            },
            wildcolor: () => {
                if(ws.selectingColor) {
                    lastPlayed.color = data.color;
                    ws.selectingColor = false;
                    if(lastPlayed.face == "PLUS4WILD") {
                        Player.cards.giveCard(Player.connected[Player.order.nextIndex()],4,2);
                    } else {
                        Player.order.advance()
                    }
                    wss.broadcast(JSON.stringify(
                        {
                            event: "lastplayed",
                            data: {
                                card: lastPlayed
                            }
                        }
                    ))
                }
            },
            calluno: () => {
                if(data.id == ws.player.id) {
                    if(ws.player.hand.length <= 2 && Player.order.currentPlayer == ws.player) {
                        ws.player.calledUno = true;
                        ws.send(JSON.stringify(
                            {
                                event: "calluno",
                                data: {id: "clear"}
                            }
                        ))
                        wss.broadcast(JSON.stringify(
                            {
                                event: "calleduno",
                                data: {id: "clear", on: data.id}
                            }
                        ))
                    }
                } else if(!Player.getPlayerById(data.id).calledUno && Player.getPlayerById(data.id).hand.length < 2) {
                    ws.send(JSON.stringify(
                        {
                            event: "calluno",
                            data: {id: "clear"}
                        }
                    ))
                    Player.cards.giveCard(Player.getPlayerById(data.id),2,0);
                    wss.broadcast(JSON.stringify(
                        {
                            event: "calleduno",
                            data: {id: ws.player.id, on: data.id}
                        }
                    ))
                }
            },
            deck: () => {
                if(!ws.deck && Player.order.currentPlayer == ws.player && !ws.selectingColor && Player.connected.length > 1) {
                    Player.cards.giveCardUntilPlayable(ws.player);
                    ws.deck = true;
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
    })
    ws.on('close', event => {
        console.log(colors["CYAN"],typeof(ws.player) == "undefined" ? "Unregistered user disconnected" : `${ws.player.name} | ${ws.player.id}: disconnected`)
        if(typeof(ws.player) != "undefined") {
            wss.broadcast(JSON.stringify(
                {
                    event: "removeplayer",
                    data: {
                        id: ws.player.id
                    }
                }
            ))
            if(Player.order.currentPlayer == ws.player) {
                if(Player.connected.length <= 1) {
                    Player.order.currentPlayer = undefined;
                } else {
                    Player.order.advance();
                }
                if(ws.selectingColor) {
                    lastPlayed.color = ["RED", "GREEN", "BLUE", "YELLOW"][Math.round(Math.random() * 3)]
                    wss.broadcast(JSON.stringify(
                        {
                            event: "lastplayed",
                            data: {
                                card: lastPlayed
                            }
                        }
                    ))
                }
            }
            for(var card of ws.player.hand) {
                card.taken = false;
            }
            Player.disconnected.push(ws.player);
            Player.connected.splice(Player.connected.indexOf(ws.player),1)
            if(Player.connected.length < 1) {
                Player.disconnected = [];
            }
            if(event != 4002) {
                setTimeout(()=>{Bot.update();},500);
            }
        }
    })
})

function exit(code, reason) {
    wss.clients.forEach(function (client) {
        client.close((code || 1000), (reason || "Server Shutting Down"));
    });
    wss.close();
    process.exit(0);
}
function restart(code, reason) {
    for(var clients of wss.clients) {
        clients.close(1012);
    }
    setupServer();
}
