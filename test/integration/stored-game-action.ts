import {config} from "dotenv";
import {getSignerFromMnemonic} from "../../src/util/signer";
import {OfflineDirectSigner} from "@cosmjs/proto-signing";
import {expect} from "chai";
import {CheckersSigningStargateClient} from "../../src/checkers_signingstargateclient";
import {CheckersExtension} from "../../src/modules/checkers/queries";
import {GasPrice} from "@cosmjs/stargate";
import {askFaucet} from "../../src/util/faucet";

config()

describe("StoredGame Action", async function () {
  const {
    RPC_URL,
    ADDRESS_TEST_ALICE,
    ADDRESS_TEST_BOB,
    MNEMONIC_TEST_ALICE,
    MNEMONIC_TEST_BOB
  } = process.env
  let aliceSigner: OfflineDirectSigner, bobSigner: OfflineDirectSigner
  let aliceClient: CheckersSigningStargateClient, bobClient: CheckersSigningStargateClient
  let checkers: CheckersExtension["checkers"]
  const aliceCredit = {stake: 100, token: 1}, bobCredit = {stake: 100, token: 1}

  before("create signers", async function () {
    aliceSigner = await getSignerFromMnemonic(MNEMONIC_TEST_ALICE)
    bobSigner = await getSignerFromMnemonic(MNEMONIC_TEST_BOB)
    expect((await aliceSigner.getAccounts())[0].address).to.equal(ADDRESS_TEST_ALICE)
    expect((await bobSigner.getAccounts())[0].address).to.equal(ADDRESS_TEST_BOB)
  })

  before("create signing clients", async function () {
    aliceClient = await CheckersSigningStargateClient.connectWithSigner(RPC_URL, aliceSigner, {
      gasPrice: GasPrice.fromString("0stake")
    })
    bobClient = await CheckersSigningStargateClient.connectWithSigner(RPC_URL, bobSigner, {
      gasPrice: GasPrice.fromString("0stake")
    })
    checkers = aliceClient.checkersQueryClient!.checkers
  })

  before("credit test accounts", async function () {
    this.timeout(10_000)
    await askFaucet(ADDRESS_TEST_ALICE, aliceCredit)
    await askFaucet(ADDRESS_TEST_BOB, bobCredit)
    expect(
      parseInt(
        (await aliceClient.getBalance(ADDRESS_TEST_ALICE, "stake")).amount, 10)
    ).to.be.greaterThanOrEqual(aliceCredit.stake)
    expect(
      parseInt(
        (await aliceClient.getBalance(ADDRESS_TEST_ALICE, "token")).amount, 10)
    ).to.be.greaterThanOrEqual(aliceCredit.token)
    expect(
      parseInt(
        (await bobClient.getBalance(ADDRESS_TEST_BOB, "stake")).amount, 10)
    ).to.be.greaterThanOrEqual(bobCredit.stake)
    expect(
      parseInt(
        (await bobClient.getBalance(ADDRESS_TEST_BOB, "token")).amount, 10)
    ).to.be.greaterThanOrEqual(bobCredit.token)
  })

  it("Temporary test", async function () {

  })
})