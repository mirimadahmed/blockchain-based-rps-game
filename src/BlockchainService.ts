import { ethers, BrowserProvider } from 'ethers';
import GameUtils from './GameUtils';

class BlockchainService {
  provider: BrowserProvider;
  contract?: ethers.Contract = undefined;
  abi: any[] = [];
  byte: string = "";
  signer: ethers.Signer;

  constructor(abi: any[], byte: string, provider: BrowserProvider, signer: ethers.Signer) {
      this.provider = provider;
      this.abi = abi;
      this.byte = byte;
      this.signer = signer;
  }

  async createCommitment(move: string): Promise<any> {
    const salt = GameUtils.generateSalt();
    const commitment = GameUtils.generateCommitment(move.toString(), salt);
    return {salt, commitment};
  }

  async createGame(stake: number, player: string, salt: string, commitment: string): Promise<any> {
    const factory = new ethers.ContractFactory(this.abi, this.byte, this.signer);
    const stakeAmount = ethers.parseEther(stake.toString());
    const contract = await factory.deploy(commitment, player, { value: stakeAmount });
    await contract.waitForDeployment();
    const address = await contract.getAddress();
    this.setContractAddress(address, this.signer);
    return address;
  }

  async playGame(stake: number, move: string): Promise<void> {
    if (!this.contract) throw new Error("Contract is not deployed or set.");
    const play = await this.contract.play(move, { value: ethers.parseEther(stake.toString()) });
    await play.wait();
  }

  async revealMove(move: string, salt: string): Promise<void> {
    if (!this.contract) throw new Error("Contract is not deployed or set.");
    const solve = await this.contract.solve(move, salt);
    await solve.wait();
  }
  
  async getFirstPlayer(): Promise<string> {
    if (!this.contract) throw new Error("Contract is not deployed or set.");
    const j1 = await this.contract.j1();
    return j1;
  }

  async getSecondPlayer(): Promise<string> {
    if (!this.contract) throw new Error("Contract is not deployed or set.");
    const j2 = await this.contract.j2();
    return j2;
  }

  async getStake(): Promise<string> {
    if (!this.contract) throw new Error("Contract is not deployed or set.");
    const stake = await this.contract.stake();
    return stake;
  }

  async player2Move(): Promise<number> {
    if (!this.contract) throw new Error("Contract is not deployed or set.");
    const c2 = await this.contract.c2();
    return Number(c2);
  }

  async timeOutPlayer1(): Promise<void> {
    if (!this.contract) throw new Error("Contract is not deployed or set.");
    const transaction = await this.contract.j1Timeout();
    await transaction.wait();
  }

  async timeOutPlayer2(): Promise<void> {
    if (!this.contract) throw new Error("Contract is not deployed or set.");
    const transaction = await this.contract.j2Timeout();
    await transaction.wait();
  }

  setContractAddress(address: string, signer: ethers.Signer) {
    this.contract = new ethers.Contract(address, this.abi, signer);
  }
}

export default BlockchainService;