// SPDX-License-Identifier: MIT

pragma solidity ^0.6.12;

import "./StratV2Manager.sol";

abstract contract FeeV2Manager is StratV2Manager {
    uint constant public MAX_FEE = 1000;
    uint constant public MAX_CALL_FEE = 111;

    uint constant public WITHDRAWAL_FEE_CAP = 50;
    uint constant public WITHDRAWAL_MAX = 10000;

    uint public withdrawalFee = 10;

    uint public callFee = 0;
    uint public LiquidCFee = 700;
    uint public customerFee = MAX_FEE - LiquidCFee - callFee;
    function setCallFee(uint256 _fee) public onlyManager {
        require(_fee <= MAX_CALL_FEE, "!cap");
        
        callFee = _fee;
        LiquidCFee = MAX_FEE - callFee;
    }

    function setLiquidCFee(uint256 _fee) public onlyManager {
        LiquidCFee = _fee;
    }

    function setCustomerFee(uint256 _fee) public onlyManager {
        customerFee = _fee;
    }

    function setWithdrawalFee(uint256 _fee) public onlyManager {
        require(_fee <= WITHDRAWAL_FEE_CAP, "!cap");

        withdrawalFee = _fee;
    }
}