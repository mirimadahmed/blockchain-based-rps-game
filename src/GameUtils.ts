import { ethers } from 'ethers';

class GameUtils {
    static generateCommitment(move: string, salt: string): string {
        // Generate a keccak256 hash of move and salt
        return ethers.keccak256(ethers.solidityPacked(['uint8', 'uint256'], [move, salt]));
    }

    static generateSalt(): string {
        // Generate a random salt of 32 bytes
        return ethers.hexlify(ethers.randomBytes(32));
    }
}

export default GameUtils;