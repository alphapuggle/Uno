const fs = require('fs');
const https = require('https');
const WebSocket = require('ws');
const os = require("os");
const { v4: uuidv4} = require("uuid");
const { POINT_CONVERSION_HYBRID } = require('constants');
const port = 860;
const server = https.createServer({
    cert: fs.readFileSync('/etc/letsencrypt/live/alphapuggle.dev/cert.pem'),
    key: fs.readFileSync('/etc/letsencrypt/live/alphapuggle.dev/privkey.pem')
})
wss = new WebSocket.Server({server})
wss.broadcast = function (event, data, sender) {
    for(ws of wss.clients) {
        if (ws != (sender || null) && typeof(ws.player) != "undefined") {
            ws.send(JSON.stringify({event:event,data:data}))
        }
    };
}
process.stdin.on("data", data => {
    try {
        let out = eval(data.toString())
        if(typeof(out) != "undefined") {
            console.log(out);
        }
    } catch (e) {
        console.log(color.red(), `\nERROR`);
        console.log(color.red(), e);
    }
})

const color = {
    "black"         :(str)=>{return color.replace("[30m","[39m",str)},
    "red"           :(str)=>{return color.replace("[31m","[39m",str)},
    "green"         :(str)=>{return color.replace("[32m","[39m",str)},
    "yellow"        :(str)=>{return color.replace("[33m","[39m",str)},
    "blue"          :(str)=>{return color.replace("[34m","[39m",str)},
    "magenta"       :(str)=>{return color.replace("[35m","[39m",str)},
    "cyan"          :(str)=>{return color.replace("[36m","[39m",str)},
    "white"         :(str)=>{return color.replace("[37m","[39m",str)},
    "gray"          :(str)=>{return color.replace("[90m","[39m",str)},
    "blackBG"       :(str)=>{return color.replace("[40m","[49m",str)},
    "redBG"         :(str)=>{return color.replace("[41m","[49m",str)},
    "greenBG"       :(str)=>{return color.replace("[42m","[49m",str)},
    "yellowBG"      :(str)=>{return color.replace("[43m","[49m",str)},
    "blueBG"        :(str)=>{return color.replace("[44m","[49m",str)},
    "magentaBG"     :(str)=>{return color.replace("[45m","[49m",str)},
    "cyanBG"        :(str)=>{return color.replace("[46m","[49m",str)},
    "whiteBG"       :(str)=>{return color.replace("[47m","[49m",str)},
    "reset"         :(str)=>{return color.replace("0m","[0m",str)},
    "bold"          :(str)=>{return color.replace("[1m","[22m",str)},
    "dim"           :(str)=>{return color.replace("[2m","[22m",str)},
    "italic"        :(str)=>{return color.replace("[3m","[23m",str)},
    "underline"     :(str)=>{return color.replace("[4m","[24m",str)},
    "inverse"       :(str)=>{return color.replace("[7m","[27m",str)},
    "hidden"        :(str)=>{return color.replace("[8m","[28m",str)},
    "strikethrough" :(str)=>{return color.replace("[9m","[29m",str)},
    "replace"       :(start,end,str="%s") => {return `\x1b${start}${str}\x1b${end}`;}
}

class Player {
    static direction = 1;
    static list = [];
    constructor(name,ws) {
        this.uuid = uuidv4();
        this.name = name;
        this.ws = ws;
        this.type = ws ? "Player" : "Bot";
        this.cards = [];
        if(Card.specificList().available.length < 7) {
            Card.addDeck();
        }
        for(let i = 0; i < 7; i++) {
            let availableCards = Card.specificList().available;
            let index = Math.floor(Math.random() * availableCards.length);
            let card = availableCards[index];
            this.cards.push(card);
            card.taken = true;
        }
        this.calledUno = false;
        this.active = Player.list.length < 1;
        Player.list.push(this);
    }
    
    playCard(uuid) {
        let card;
        for(let selected of this.cards) {
            if(selected.uuid == uuid) {
                card = selected;
                break;
            }
        }
        if(this.active) {
            if(typeof(card) != "undefined") {
                
            } else {
                return {err:"Card not in player's deck"}
            }
            
        } else {
            return {err:"Player is not active player"}
        }
    }
    disconnect() {
        if(this.active && Player.list.length > 1) {
            Player.order();
        }
        for(let card of this.cards) {
            card.taken = false;
        }
        Player.list.splice(Player.list.indexOf(this),1);
    }
    static validateName(name) {
        for(let player of Player.list) {
            if(player.name.toLowerCase() == name.toLowerCase()) {
                return false;
            }
        }
        return true;
    }
    static order(turns=1,advance=true) {
        let selectedPlayer;
        for(let i = 0; i < Player.list.length; i++) {
            if(Player.list[i].active) {
                selectedPlayer = i;
                if(advance) {
                    Player.list[i].active = false;
                }
            }
        }
        for(let i = 0; i < turns; i++) {
            selectedPlayer += Player.direction;
            if(selectedPlayer >= Player.list.length) {
                selectedPlayer = 0;
            } else if (selectedPlayer <= 0) {
                selectedPlayer = Player.list.length -1;
            }
        }
        if(advance) {
            Player.list[selectedPlayer].active = true;
        }
        return Player.list[selectedPlayer];
    }
}
class Card {
    static list = [];
    static activeCard;
    static colors = ["red", "yellow", "green", "blue", "black"]
    static figures = ["skip","reverse","+2","wild","wild+4"]
    constructor(color, figure) {
        this.uuid = uuidv4();
        this.color = color.toString().toLowerCase();
        this.figure = figure.toString().toLowerCase();
        this.taken = false;
        if(Card.colors.includes(color) && (Card.figures.includes(figure) || (figure >= 0 && figure <= 9))) {
            Card.list.push(this);
        }
    }
    static specificList() {
        let list = {
            taken:[],
            available:[]
        }
        for(let card of Card.list) {
            if(card.taken) {
                list.taken.push(card);
            } else {
                list.available.push(card);
            }
        }
        return list;
    }
    static addDeck() {
        var count = 0;
        for (let color of Card.colors) {
            if(color != "black") {
                new Card(color,0);
                count ++
                for (let number = 1; number < 10; number++) {
                    new Card(color,number)
                    new Card(color,number)
                    count += 2
                }
                for (let figure of Card.figures) {
                    if(!figure.includes("wild")) {
                        new Card(color,figure)
                        new Card(color,figure)
                        count += 2
                    }
                }
            }
        }
        for (let number = 0; number < 4; number++) {
            new Card("black","wild+4")
            new Card("black","wild")
            count += 2
        }
        console.log(color.cyan(`Added ${count} cards to the deck. ${Card.list.length} total.`))
    }
    static setup() {
        Card.addDeck();
        let availableCards = Card.specificList().available;
        while(typeof(Card.activeCard) == "undefined" || Card.activeCard.color == "black") {
            if(typeof(Card.activeCard) != "undefined") {
                Card.activeCard.taken = false;
            }
            Card.activeCard = availableCards[Math.floor(Math.random() * availableCards.length)];
            Card.activeCard.active = true;
        }
        console.log(`First Card: ${color[Card.activeCard.color](`${Card.activeCard.color.toString().toUpperCase()}:${Card.activeCard.figure.toString().toUpperCase()}`)}`);
    }
}
wss.on("connection",(ws)=>{
    ws.event = (event,data) => {
        ws.send(JSON.stringify({event:event,data:data}))
    }
    console.log(color.cyan(`New connection from: ${ws._socket.remoteAddress}`));
    ws.on("message",(msg)=>{
        try {
            msg = JSON.parse(msg);
            action = msg.event
            data = msg.data;
            console.log(msg);
        } catch(e) {
            action = "nonJSON"
            data = {data:msg};
        }
        var actions = {
            player:() =>{
                if(data.name.length >= 2 && Player.validateName(data.name)) {
                    let otherPlayers = [];
                    ws.player = new Player(data.name,ws);
                    for(let player of Player.list) {
                        otherPlayers.push({
                            name:player.name,
                            uuid:player.uuid,
                            cards:player == ws.player ? player.cards : player.cards.length
                        }) 
                    }
                    ws.event("player",{players:otherPlayers});
                    wss.broadcast("player",{players:[{name:ws.player.name,uuid:ws.player.uuid,cards:ws.player.cards.length}]},ws)
                } else if(data.name.length < 2){
                    ws.event("player",{err:"Name too short"});
                    console.log(`${data.name} too short`)
                } else {
                    ws.event("player",{err:"Name taken"});
                    console.log(`${data.name} already taken`)
                }
            },
            nonJSON:()=>{
                console.error(`Failed to parse ${data}`);
            },
            invalidAction:() => {
                console.error(`Invalid action ${msg}`);
            }
        }
        if(Object.keys(actions).includes(action)) {
            try{
                actions[action]();
            } catch(e) {
                console.error(e)
            }
        } else {
            action["invalidAction"]();
        }
    })
    ws.on("close",(close)=> {
        console.log(close);
        if(typeof(ws.player) != "undefined") {
            wss.broadcast("disconnect",{uuid:ws.player.uuid});
            ws.player.disconnect();
        }
    })
})
server.on("listening",()=>{
    for(let adapter of Object.keys(os.networkInterfaces()).filter(name => name.substring(0,1) == "e")) {
        for(let address of os.networkInterfaces()[adapter]) {
            console.log(`Now listening on https://${address.family == "IPv6" ? "[" + address.address + "]" : address.address}:${server.address().port}`)
        }
    }
    Card.setup();
});
server.listen(port);