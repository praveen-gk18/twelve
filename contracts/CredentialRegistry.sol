// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IInstitutionRegistry {
    function isApproved(address institution) external view returns (bool);
}

contract CredentialRegistry {
    IInstitutionRegistry public institutionRegistry;

    enum Status {
        Active,
        Revoked
    }

    struct Credential {
        bytes32 credentialHash;
        address issuer;
        bytes32 holderHash;
        uint256 issuedAt;
        uint256 expiresAt;
        Status status;
        string metadataURI;
    }

    mapping(bytes32 => Credential) public credentials;

    event CredentialIssued(bytes32 indexed credentialId, address indexed issuer, bytes32 credentialHash, string metadataURI);
    event CredentialRevoked(bytes32 indexed credentialId, string reason);

    constructor(address registryAddress) {
        institutionRegistry = IInstitutionRegistry(registryAddress);
    }

    function issueCredential(
        bytes32 credentialId,
        bytes32 credentialHash,
        bytes32 holderHash,
        uint256 expiresAt,
        string calldata metadataURI
    ) external {
        require(institutionRegistry.isApproved(msg.sender), "Unauthorized issuer");
        require(credentials[credentialId].issuedAt == 0, "Credential already exists");

        credentials[credentialId] = Credential({
            credentialHash: credentialHash,
            issuer: msg.sender,
            holderHash: holderHash,
            issuedAt: block.timestamp,
            expiresAt: expiresAt,
            status: Status.Active,
            metadataURI: metadataURI
        });

        emit CredentialIssued(credentialId, msg.sender, credentialHash, metadataURI);
    }

    function revokeCredential(bytes32 credentialId, string calldata reason) external {
        Credential storage credential = credentials[credentialId];
        require(credential.issuer == msg.sender, "Only issuing institution can revoke");
        credential.status = Status.Revoked;
        emit CredentialRevoked(credentialId, reason);
    }

    function verifyCredential(bytes32 credentialId, bytes32 hashToCheck)
        external
        view
        returns (bool valid, Status status, address issuer)
    {
        Credential memory credential = credentials[credentialId];
        bool hashMatch = credential.credentialHash == hashToCheck;
        bool active = credential.status == Status.Active;
        bool notExpired = credential.expiresAt == 0 || block.timestamp <= credential.expiresAt;

        return (hashMatch && active && notExpired, credential.status, credential.issuer);
    }
}
