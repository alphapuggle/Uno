var card = Player.connected[0].hand[Math.floor(Player.connected[0].hand.length * Math.random())].element;
var animateCard = (playerCard, destinationCard, direction = 1) => {
    if(direction == -1) {
        var temp = playerCard;
        playerCard = destinationCard;
        destinationCard = temp;
    }
    playerCard.style.visibility = "hidden";
    var animateCard = document.createElement("img");
    animateCard.classList.add("card");
    animateCard.setAttribute("disabled",playerCard.getAttribute("disabled"))
    animateCard.style.position = "absolute";
    document.body.appendChild(animateCard);
    animateCard.src = "./Cards/UNKNOWN.png";
    animateCard.animate(
        [
            {
                left: `${destinationCard.getBoundingClientRect().left}px`,
                right: `${destinationCard.getBoundingClientRect().right}px`,
                top: `${destinationCard.getBoundingClientRect().top}px`,
                bottom: `${destinationCard.getBoundingClientRect().bottom}px`,
                width: `${destinationCard.getBoundingClientRect().width}px`,
                transform: "scaleX(1) rotateY(0deg)",
                content: `url("${destinationCard.src}")`
            }, 
            {
                transform: "scaleX(1) rotateY(0deg)",
                content: `url("${destinationCard.src}")`
            },
            {
                transform: "scaleX(-1) rotateY(180deg)",
                content: `url("${playerCard.src}")`
            },
            {
                left: `${playerCard.getBoundingClientRect().left}px`,
                right: `${playerCard.getBoundingClientRect().right}px`,
                top: `${playerCard.getBoundingClientRect().top}px`,
                bottom: `${playerCard.getBoundingClientRect().bottom}px`,
                width: `${playerCard.getBoundingClientRect().width}px`,
                transform: "scaleX(-1) rotateY(180deg)",
                content: `url("${playerCard.src}")`
            }
        ], {duration: 1000}
    ).onfinish = () => {
        animateCard.remove();
        playerCard.style.visibility = "visible"
    }
}
animateCard(card,$("#lastCard"));