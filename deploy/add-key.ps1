# Puts this computer's SSH key on the new server once (asks for the server's password, typed by you).
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | ssh ubuntu@185.146.1.53 "mkdir -p ~/.ssh && chmod 700 ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys && echo KEY-ADDED"
