const {
  DirectSecp256k1HdWallet,
  decodeTxRaw,
  decodePubkey,
} = require("@cosmjs/proto-signing");
const { SigningStargateClient } = require("@cosmjs/stargate");
const fs = require("fs");
const config = require("../config.json");

(async () => {
  const wallet = await DirectSecp256k1HdWallet.fromMnemonic(config.seed, {
    prefix: config.prefix,
  });

  let [firstAccount] = await wallet.getAccounts();
  let walletAddress = firstAccount.address;

  const client = await SigningStargateClient.connectWithSigner(
    config.rpcEndpoint,
    wallet
  );

  const contract =
    "CDB1CA41E399DF84CA70C0FAAFFFF07816B7F0A8A9AE6AA81A6DEC0AFD28600E";

  const address = walletAddress; // BE SURE THIS ADDRESS IS IN THE GLOME CONFIG FOR ONES TO BE REGISTERD INTERACTIONS

  let state = btoa(
    JSON.stringify({
      function: "createPost",
      inputs: {
        post: {
          title: "Test",
          body: "This is body text",
        },
      },
    })
  );

  let previousTxId = "Start";

  let postChunks = chunkBase64(state);
  reversedChunks = postChunks.reverse();

  for (let i = 0; i <= reversedChunks.length; i++) {
    let memo;

    // As the last transaction is the one used to interact with contracts, we stick the interacting contract here too

    if (reversedChunks.length == i) {
      memo = [reversedChunks[i], previousTxId, contract].toString();
    } else {
      // If its not the last just do the normal method
      memo = [reversedChunks[i], previousTxId].toString();
    }

    const res = await client.signAndBroadcast(
      walletAddress,
      [
        {
          typeUrl: "/cosmos.bank.v1beta1.MsgSend",
          value: {
            fromAddress: walletAddress,
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

  console.log("Interaction ID: " + previousTxId);
})();

function chunkBase64(base64, length = 190) {
  const base64Array = [];
  for (let i = 0; i < base64.length; i += length) {
    base64Array.push(base64.slice(i, i + length));
  }
  return base64Array;
}
