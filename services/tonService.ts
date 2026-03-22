import { SendTransactionRequest } from '@tonconnect/ui-react';

export const TREASURY_ADDRESS = '0QC2QYb_rY288lbVinWCkejq9A1sjafOA_yO1OF980r8yTF0';

export const buildTONTransaction = (amountInTon: number): SendTransactionRequest => {
    const nanoTon = Math.floor(amountInTon * 1000000000).toString();
    
    return {
        validUntil: Math.floor(Date.now() / 1000) + 360, // 6 minutes
        messages: [
            {
                address: TREASURY_ADDRESS,
                amount: nanoTon,
            }
        ]
    };
};
