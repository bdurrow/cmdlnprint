# ubuntu/firefox/cmdlnprint docker image

To use:

```
git clone https://github.com/eclipxe13/cmdlnprint.git
cd cmdlnprint/docker
docker build -t cmdlnprint:latest ./
mkdir -p cmdlnprint_shared/output
docker run --rm --volume `pwd`/cmdlnprint_shared/:/home/firefox/shared cmdlnprint:latest firefox -print https://google.com -print-mode pdf -print-file /home/firefox/shared/output/google.pdf
```

Your file should now be in cmdlnprint_shared/output/

Note that firefox will *NOT* be able to write to /home/firefox/shared inside the container because of [this known issue (https://github.com/docker/docker/issues/3124)].

