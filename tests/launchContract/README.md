# Publish Contract

# Spec

You'll have your contract code in base64 form, however memos limit to 256 characters.
So you'll have to chain transactions in a sort of pagination way.

Using array to store more space in the memo
["base64 Of Src Code", "Previous"]

Then glome will merge all these transactions to merge the contract src. For the contracts to be interacted with, the starting txid must be used
