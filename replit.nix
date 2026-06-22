{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.python312
    pkgs.python312Packages.pip
    pkgs.python312Packages.virtualenv
    pkgs.git
  ];
}
