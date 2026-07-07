// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {FHE, euint8, euint16, ebool, externalEuint8, externalEuint16} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title ConfidentialIdentity — Crivacy-style private on-chain identity with Zama FHE
/// @notice Users register an *encrypted* identity (age + country code). They can then produce
///         attestations such as "I am at least N years old" or "I am NOT from country X" and
///         grant a specific verifier permission to decrypt ONLY that boolean result — never the
///         underlying age or nationality. This is the KYC-without-doxxing pattern that FHE unlocks.
/// @dev Built on FHEVM (@fhevm/solidity ^0.11). Encrypted types (euint8/euint16/ebool) hold
///      ciphertext handles; comparisons run on-chain over encrypted data via the coprocessor.
contract ConfidentialIdentity is ZamaEthereumConfig {
    struct Identity {
        euint8 age; // 0..255, encrypted
        euint16 country; // ISO-3166 numeric code, encrypted
        bool exists;
    }

    /// @dev The registered encrypted identity per user.
    mapping(address user => Identity identity) private _identities;

    /// @dev The latest boolean attestation a user produced, keyed by user.
    mapping(address user => ebool attestation) private _attestations;

    event IdentityRegistered(address indexed user);
    event AttestationIssued(address indexed user, address indexed verifier);

    error IdentityNotFound(address user);

    /// @notice Register (or overwrite) the caller's encrypted identity.
    /// @param ageExt encrypted age handle
    /// @param countryExt encrypted country-code handle
    /// @param inputProof the single input proof covering both encrypted handles
    function registerIdentity(
        externalEuint8 ageExt,
        externalEuint16 countryExt,
        bytes calldata inputProof
    ) external {
        euint8 age = FHE.fromExternal(ageExt, inputProof);
        euint16 country = FHE.fromExternal(countryExt, inputProof);

        _identities[msg.sender] = Identity({age: age, country: country, exists: true});

        // Persist access so the contract can reuse these ciphertexts in later txs,
        // and let the owner decrypt their own data off-chain if they wish.
        FHE.allowThis(age);
        FHE.allowThis(country);
        FHE.allow(age, msg.sender);
        FHE.allow(country, msg.sender);

        emit IdentityRegistered(msg.sender);
    }

    /// @notice Prove `age >= threshold` to a verifier without revealing the age.
    /// @param threshold minimum age to attest (e.g. 18)
    /// @param verifier address allowed to decrypt the resulting boolean
    function attestMinimumAge(uint8 threshold, address verifier) external {
        Identity storage id = _identities[msg.sender];
        if (!id.exists) revert IdentityNotFound(msg.sender);

        ebool ok = FHE.ge(id.age, threshold);
        _grantAttestation(ok, verifier);
    }

    /// @notice Prove `country != bannedCountry` (e.g. not from a sanctioned jurisdiction)
    ///         without revealing which country the user is actually from.
    /// @param bannedCountry the country code to prove exclusion from
    /// @param verifier address allowed to decrypt the resulting boolean
    function attestNotFromCountry(uint16 bannedCountry, address verifier) external {
        Identity storage id = _identities[msg.sender];
        if (!id.exists) revert IdentityNotFound(msg.sender);

        ebool ok = FHE.ne(id.country, bannedCountry);
        _grantAttestation(ok, verifier);
    }

    /// @notice Returns the caller's last attestation ciphertext handle. The handle is only
    ///         decryptable by addresses that were granted access when it was issued.
    function getAttestation(address user) external view returns (ebool) {
        return _attestations[user];
    }

    /// @notice Whether a user has registered an encrypted identity.
    function hasIdentity(address user) external view returns (bool) {
        return _identities[user].exists;
    }

    function _grantAttestation(ebool ok, address verifier) private {
        _attestations[msg.sender] = ok;

        FHE.allowThis(ok);
        FHE.allow(ok, msg.sender); // owner can see their own result
        FHE.allow(ok, verifier); // the verifier can decrypt ONLY this boolean

        emit AttestationIssued(msg.sender, verifier);
    }
}
