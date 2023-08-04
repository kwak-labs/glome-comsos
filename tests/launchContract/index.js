const {
  DirectSecp256k1HdWallet,
  OfflineDirectSigner,
} = require("@cosmjs/proto-signing");
const { Coin, SigningStargateClient } = require("@cosmjs/stargate");
const fs = require("fs");
const config = require("../config.json");
(async () => {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(config.seed, {
    prefix: config.prefix,
  });

  let [firstAccount] = await wallet.getAccounts();
  let address = firstAccount.address;

  const client = await SigningStargateClient.connectWithSigner(
    config.rpcEndpoint,
    wallet
  );

  const contractSrc = fs.readFileSync("./contract.js");

  let contractChunks = chunkBase64(btoa(contractSrc));
  let reversedChunks = contractChunks.reverse();

  let previousTxId = "Start";

  for (let i = 0; i <= reversedChunks.length; i++) {
    const message = {
      typeUrl: "/cosmos.bank.v1beta1.MsgSend",
      value: {
        fromAddress: address,
        toAddress: address,
        amount: [
          {
            denom: config.denom,
            amount: "100",
          },
        ],
      },
    };

    const fee = {
      amount: [
        {
          denom: config.denom,
          amount: "100",
        },
      ],
      gas: "180000",
    };

    let memo = [reversedChunks[i], previousTxId].toString();

    const res = await client.signAndBroadcast(address, [message], fee, memo);
    previousTxId = res.transactionHash;
  }

  const srcid = previousTxId;

  console.log("Code ID: " + previousTxId);

  let state = btoa(
    JSON.stringify({
      posts: {},
    })
  );

  previousTxId = "Start";

  let postChunks = chunkBase64(state);
  reversedChunks = postChunks.reverse();

  for (let i = 0; i <= reversedChunks.length; i++) {
    let memo;

    // As the last transaction is the one used to interact with contracts, we stick the src contract there too
    if (reversedChunks.length == i) {
      memo = [reversedChunks[i], previousTxId, srcid].toString();
    } else {
      // If its not the last just do the normal method
      memo = [reversedChunks[i], previousTxId].toString();
    }

    const res = await client.signAndBroadcast(
      address,
      [
        {
          typeUrl: "/cosmos.bank.v1beta1.MsgSend",
          value: {
            fromAddress: address,
            toAddress: address,
            amount: [
              {
                denom: config.denom,
                amount: "100",
              },
            ],
          },
        },
      ],
      {
        amount: [
          {
            denom: config.denom,
            amount: "100",
          },
        ],
        gas: "180000",
      },
      memo
    );
    previousTxId = res.transactionHash;
  }

  console.log("Contract ID: " + previousTxId);
})();

function chunkBase64(base64, length = 190) {
  const base64Array = [];
  for (let i = 0; i < base64.length; i += length) {
    base64Array.push(base64.slice(i, i + length));
  }
  return base64Array;
}

function concatArray(base64Array) {
  return base64Array.join("");
}
