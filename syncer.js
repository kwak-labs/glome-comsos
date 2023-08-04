let {
  executeTxQuery,
  executeBundlrQuery,
  wait,
  makeBundlrQuery,
  findTxById,
} = require("./utils.js");
let consola = require("consola");
let startExecutionSyncLoop = require("./executionSync.js");
let lmdb = require("lmdb");
const { fetch } = require("ofetch");

module.exports = async function startSyncLoop() {
  // Fetch Network data
  async function syncNetworkInfo() {
    let gatewayNetworkInfo = await fetch(
      config.gateways.rpcConfig + "/abci_info"
    )
      .catch((e) => null)
      .then((c) => c.json());
    global.networkInfo =
      gatewayNetworkInfo.result.response || global.networkInfo;
  }

  await syncNetworkInfo();

  //   Log network info
  consola.info("Chain Name/Data: " + global.networkInfo.data);
  consola.info("Block height: " + global.networkInfo.last_block_height);
  consola.info("App Version: " + global.networkInfo.version);
  consola.info(
    "Last Block App hash: " + global.networkInfo.last_block_app_hash
  );

  // Set the plugins
  global.plugins = Object.fromEntries(
    await Promise.all(
      (config.plugins || []).map(async (pl) => {
        let plugin = require(pl);
        let pluginApi = await plugin.setup(config);
        return [plugin.id, pluginApi];
      })
    )
  );

  //   // Resync network info
  //   setInterval(syncNetworkInfo, 25000);

  //   for await (let contract of await executeTxQuery(
  //     0,
  //     [
  //       ["Contract-Src", config.allowed.contractSourceIds],
  //       ["App-Name", ["SmartWeaveContract"]],
  //     ],
  //     false,
  //     null
  //   )) {
  //     await databases.contracts.put(contract.id, contract);
  //     servedContractsIds.add(contract.id);
  //   }

  for (let contract of config.allowed.contractIds) {
    let contractTx = await findTxById(contract);

    await databases.contracts.put(contract, contractTx);
  }

  //   setInterval(async () => {
  //     for await (let contract of await executeTxQuery(
  //       0,
  //       [
  //         ["Contract-Src", config.allowed.contractSourceIds],
  //         ["App-Name", ["SmartWeaveContract"]],
  //       ],
  //       false,
  //       null
  //     )) {
  //       // console.log("fetched contract "+contract.id)
  //       await databases.contracts.put(contract.id, contract);
  //       servedContractsIds.add(contract.id);
  //     }
  //   }, 10000);

  consola.info("Serving " + servedContractsIds.size + " contracts");

  for (
    let contractIndex = 0;
    contractIndex < servedContractsIds.size;
    contractIndex += 4
  ) {
    let contracts = Array.from(servedContractsIds).slice(
      contractIndex,
      contractIndex + 4
    );

    // If no interacting list for this contract create it
    for (let contract of contracts) {
      if (!databases.interactions[contract]) {
        databases.interactions[contract] = lmdb.open(
          "./db/interactions/" + contract
        );
      }
    }

    let transactions = await executeTxQuery(
      global.config.allowed.excutionWallets
    );

    for await (let txForContract of transactions) {
      if (txForContract == undefined) continue;

      // Runs in the case someone tried interacting with a contract that isnt being cached by glome
      if (!servedContractsIds.has(txForContract.contractId)) continue;

      if (
        !(await databases.interactions[txForContract.contractId].doesExist(
          txForContract.interactionId
        ))
      ) {
        await databases.interactions[txForContract.contractId].put(
          txForContract.interactionId,
          txForContract
        );
        consola.info(
          "[" + txForContract.blockHeight + "]",
          "Loaded base interaction " +
            txForContract.interactionId +
            " for contract " +
            txForContract.contractId
        );
      }
    }

    consola.success("Loaded contracts " + contracts.join(", "));
  }

  consola.info("All contracts loaded");

  for (let contract of [...servedContractsIds]) {
    if (!databases.interactions[contract]) {
      databases.interactions[contract] = lmdb.open(
        "./db/interactions/" + contract
      );
    }

    console.log(
      await databases.indexes.put(
        contract,
        [
          ...databases.interactions[contract]
            .getRange()
            .map(({ key, value }) => ({
              id: value.interactionId,
              blockHeight: value.blockHeight,
            })),
        ]
          .sort((a, b) => a.blockHeight - b.blockHeight)
          .map((i) => i.interactionId)
      )
    );
    consola.info("Sorted interactions for contract " + contract);
  }
  consola.success("Synced all contracts interactions");
  startExecutionSyncLoop();

  setInterval(async () => {
    for (
      let contractIndex = 0;
      contractIndex < servedContractsIds.size;
      contractIndex += 4
    ) {
      let contracts = Array.from(servedContractsIds).slice(
        contractIndex,
        contractIndex + 4
      );

      // If no interacting list for this contract create it
      for (let contract of contracts) {
        if (!databases.interactions[contract]) {
          databases.interactions[contract] = lmdb.open(
            "./db/interactions/" + contract
          );
        }
      }

      let transactions = await executeTxQuery(
        global.config.allowed.excutionWallets
      );

      for await (let txForContract of transactions) {
        if (txForContract == undefined) continue;

        // Runs in the case someone tried interacting with a contract that isnt being cached by glome
        if (!servedContractsIds.has(txForContract.contractId)) continue;

        if (
          !(await databases.interactions[txForContract.contractId].doesExist(
            txForContract.interactionId
          ))
        ) {
          await databases.interactions[txForContract.contractId].put(
            txForContract.interactionId,
            txForContract
          );
          consola.info(
            "[" + txForContract.blockHeight + "]",
            "Loaded base interaction " +
              txForContract.interactionId +
              " for contract " +
              txForContract.contractId
          );
        }
      }

      consola.success("Loaded contracts " + contracts.join(", "));
    }
  }, Math.max(servedContractsIds.size * 300, 4000));

  setInterval(async () => {}, Math.max(servedContractsIds.size * 300, 4000));
};
