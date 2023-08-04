const {
  DirectSecp256k1HdWallet,
  decodeTxRaw,
  decodePubkey,
} = require("@cosmjs/proto-signing");
const { StargateClient } = require("@cosmjs/stargate");
const { toBech32, fromHex } = require("@cosmjs/encoding");
const { pubkeyToAddress } = require("@cosmjs/tendermint-rpc");
let consola = require("consola");
const config = require("../config.json");

(async () => {
  const client = await StargateClient.connect(config.rpcEndpoint);

  const contract =
    "CDB1CA41E399DF84CA70C0FAAFFFF07816B7F0A8A9AE6AA81A6DEC0AFD28600E";
  let fetchingCode = true;

  // State of contract, either code, or init state
  let base64state = "";

  // If its an init state get the contract src code
  let srcId = "Contract Is Code"; // Set this as default incase this isnt an interaction/init state

  let contractData = decodeTxRaw((await client.getTx(contract)).tx);

  while (fetchingCode) {
    let memo = contractData.body.memo;

    let [contractCode, previousTxId, srcid] = memo.split(",");

    if (srcid) {
      srcId = srcid;
    }

    base64state += contractCode;

    if (previousTxId == "Start") {
      fetchingCode = false;
    } else {
      contractData = decodeTxRaw((await client.getTx(previousTxId)).tx);
    }
  }

  // Decode pubkey to address
  let signers = contractData.authInfo.signerInfos.map((signerInfo) =>
    toBech32(
      config.prefix,
      fromHex(
        pubkeyToAddress(
          "secp256k1",
          Buffer.from(decodePubkey(signerInfo.publicKey).value, "base64"),
          "base64"
        )
      )
    )
  );

  consola.info("Contract/Contract Src: " + srcId);
  consola.info("Contract Interactor/Creator: " + signers);
  consola.info(atob(base64state));
})();
