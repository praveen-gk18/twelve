// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract InstitutionRegistry {
    address public admin;

    struct Institution {
        string name;
        string did;
        bool approved;
        uint256 approvedAt;
    }

    mapping(address => Institution) public institutions;

    event InstitutionApproved(address indexed institution, string name, string did);
    event InstitutionSuspended(address indexed institution);

    constructor() {
        admin = msg.sender;
    }

    modifier onlyAdmin() {
        require(msg.sender == admin, "Not admin");
        _;
    }

    function approveInstitution(address institution, string calldata name, string calldata did) external onlyAdmin {
        institutions[institution] = Institution({
            name: name,
            did: did,
            approved: true,
            approvedAt: block.timestamp
        });

        emit InstitutionApproved(institution, name, did);
    }

    function suspendInstitution(address institution) external onlyAdmin {
        institutions[institution].approved = false;
        emit InstitutionSuspended(institution);
    }

    function isApproved(address institution) external view returns (bool) {
        return institutions[institution].approved;
    }
}
