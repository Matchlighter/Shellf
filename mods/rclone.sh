# rclone — sync to and from cloud storage. Ships zip only, so a box with no
# unzip and no python3 cannot unpack it; mirror it as a plain binary instead.
DESC="sync to and from cloud storage"
V=${SHLF_V_RCLONE:-1.75.0}
KIND=zip
URL="https://github.com/rclone/rclone/releases/download/v$V/rclone-v$V-${OS}-${A_GO}.zip"
