import asyncio

from tecnohead_display.app.immich import ImmichPhotoFrame


def test_photo_frame_without_credentials_is_safe(tmp_path):
    frame = ImmichPhotoFrame(
        base_url="http://immich.local",
        api_key="",
        album_id="",
        cache_dir=tmp_path,
    )

    result = asyncio.run(frame.list_photos())

    assert result["configured"] is False
    assert result["photos"] == []
    assert "api_key" not in result


def test_photo_frame_accepts_images_and_rejects_videos():
    assert ImmichPhotoFrame._is_image({"type": "IMAGE", "originalMimeType": "image/jpeg"})
    assert not ImmichPhotoFrame._is_image({"type": "VIDEO", "originalMimeType": "video/mp4"})


def test_photo_path_rejects_traversal(tmp_path):
    frame = ImmichPhotoFrame(
        base_url="http://immich.local",
        api_key="key",
        album_id="album",
        cache_dir=tmp_path,
    )
    (tmp_path / "safe.jpg").write_bytes(b"image")

    assert frame.photo_path("safe.jpg") == (tmp_path / "safe.jpg").resolve()
    assert frame.photo_path("../safe.jpg") is None
