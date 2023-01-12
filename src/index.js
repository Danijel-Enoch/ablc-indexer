const mongoose = require('mongoose');
const app = require('./app');
const config = require('./config/config');
const logger = require('./config/logger');
const { ethers,utils } = require("ethers");
const abi = require("./abi/abi.json");
const {OrderCreated,OrderCancelled,OrderExchanged} = require("./models/index")

function listenToEvent() {
  function convert(value, unit = "ether") {
    if (value instanceof ethers.BigNumber) {
        return utils.formatUnits(value.toString(), unit);
    } else {
        return ethers.BigNumber.from(value);
    }
}
  var wsProvider = new ethers.providers.WebSocketProvider("wss://ws-nd-749-433-574.p2pify.com/06b5e75facd84cfaf70e5942c24ae111");
  const contractAddress = "0x2c9F84Baa3071Dac7661c48760Ca78f601d95fF1";
  const listener = new ethers.Contract(contractAddress, abi, wsProvider);
    console.info("Indexer Started")
  listener.on("OrderCreated", async (Oid, orderType, tokenA, tokenB, baseAmount, quoteAmount,creator, event) => {
    const cBaseAmount=tokenA==="0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"|| tokenA==="0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" || tokenA==="0x55d398326f99059fF775485246999027B3197955"?convert(baseAmount):parseFloat(baseAmount.toString()) / 100000000
    const cquoteAmount=tokenA==="0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"|| tokenA==="0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c" || tokenA==="0x55d398326f99059fF775485246999027B3197955"?convert(quoteAmount):parseFloat(baseAmount.toString()) / 100000000
    const buy="buy"
    console.log({ Oid, orderType, tokenA, tokenB, cBaseAmount, cquoteAmount,creator },{event})
    await OrderCreated.create({ Oid, orderType, tokenA, tokenB, baseAmount:cBaseAmount, quoteAmount:cquoteAmount,creator,tx:"false" })
  })
  listener.on("OrderCancelled", async (Oid, person, event) => {
    console.log({ Oid, person })
    await OrderCancelled.create({ Oid, person })
  })

  listener.on("OrderExchanged", async (buyer, seller, Oid, bamount, quoteAmount, event) => {
    const cBaseAmount=convert(bamount)
    const cquoteAmount=convert(quoteAmount)
    console.log({ buyer, seller, Oid, bamount, quoteAmount, })
    await OrderCreated.findOneAndUpdate(Oid,{tx:"true"})
    await OrderExchanged.create({ buyer, seller, Oid, cBaseAmount, cquoteAmount })
  })


}

let server;
mongoose.connect(config.mongoose.url, config.mongoose.options).then(() => {
  logger.info('Connected to MongoDB');
  server = app.listen(config.port, () => {
    logger.info(`Listening to port ${config.port}`);
  });
});

const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info('Server closed');
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on('uncaughtException', unexpectedErrorHandler);
process.on('unhandledRejection', unexpectedErrorHandler);

process.on('SIGTERM', () => {
  logger.info('SIGTERM received');
  if (server) {
    server.close();
  }
});


listenToEvent()
