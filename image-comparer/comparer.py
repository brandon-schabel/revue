import imagehash
from PIL import Image

def compare_images(image1_path, image2_path):
    img1 = Image.open(image1_path)
    img2 = Image.open(image2_path)
    
    # Generate perceptual hashes
    hash1 = imagehash.average_hash(img1)
    hash2 = imagehash.average_hash(img2)

    print(f"Image hashes: {hash1} and {hash2}")
    
    # Calculate the difference between hashes
    difference = hash1 - hash2
    
    # A lower difference indicates more similarity
    print(f"Image difference: {difference}")
    return difference

# Example usage
difference = compare_images('diff-test-1.jpg', 'diff-test-2.jpg')
if difference < 10:
    print("Images are likely similar")
else:
    print("Images are likely different")