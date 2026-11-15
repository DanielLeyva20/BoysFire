package pe.boysfire.api.common.error;

/** La petición está bien formada pero pide algo que la API no acepta (HTTP 400). */
public class InvalidRequestException extends RuntimeException {

    public InvalidRequestException(String message) {
        super(message);
    }
}
