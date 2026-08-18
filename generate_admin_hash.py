from getpass import getpass
from werkzeug.security import generate_password_hash
p=getpass("Nhập mật khẩu Admin mới: ")
print("\nADMIN_PASSWORD_HASH="+generate_password_hash(p))
